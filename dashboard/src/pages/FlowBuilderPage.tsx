import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from '../hooks/useToast';

import {
  Save,
  ArrowLeft,
  Trash2,
  HelpCircle,
  Settings,
  AlertCircle,
  GitPullRequest,
  Clock,
  Zap,
  MessageSquare,
  Bot,
  X,
  FileImage,
  Upload,
  Download,
  User,
  Share2,
  Shuffle,
  ArrowRightLeft
} from 'lucide-react';
import { exportFlow } from '../lib/FlowJsonHandler';
import AssetSelector from '../components/AssetSelector';

interface Flow {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

interface FlowNode {
  id: string;
  flow_id: string;
  type: 'message' | 'interactive' | 'delay' | 'condition' | 'action' | 'ai_route' | 'capture_input' | 'lead_webhook' | 'randomizer' | 'goto_flow';
  data: {
    text?: string;
    mediaUrl?: string;
    mediaType?: 'image' | 'video' | 'audio' | 'file';
    buttons?: Array<{
      type: 'web_url' | 'postback' | 'phone_number';
      title: string;
      url?: string;
      payload?: string;
    }>;
    quickReplies?: Array<{
      title: string;
      payload: string;
    }>;
    whatsappType?: 'button' | 'list';
    whatsappButtons?: Array<{
      id: string;
      title: string;
    }>;
    whatsappList?: {
      buttonText: string;
      sections: Array<{
        title: string;
        rows: Array<{
          id: string;
          title: string;
          description?: string;
        }>;
      }>;
    };
    delaySeconds?: number;
    delayType?: 'short' | 'long';
    conditionKey?: string;
    conditionValue?: string;
    conditionOperator?: 'equals' | 'contains' | 'exists';
    actionType?: 'add_tag' | 'remove_tag' | 'set_attribute' | 'pause_bot' | 'resume_bot' | 'trigger_webhook';
    actionParams?: Record<string, any>;
    // New simplified visual options
    captureKey?: string;
    captureType?: 'email' | 'phone' | 'text';
    validationErrorMessage?: string;
    webhookUrl?: string;
    targetFlowId?: string;
  };
  position: { x: number; y: number };
}

interface FlowEdge {
  id: string;
  flow_id: string;
  source_node_id: string;
  target_node_id: string;
  source_handle: string; // 'default', 'true', 'false', or button title/payload
}

export default function FlowBuilderPage() {
  const { flowId } = useParams<{ flowId: string }>();
  const navigate = useNavigate();

  const [flow, setFlow] = useState<Flow | null>(null);
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<FlowEdge[]>([]);
  const [otherFlows, setOtherFlows] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // UX / Interaction state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [linkingSource, setLinkingSource] = useState<{ nodeId: string; handleId: string } | null>(null);
  const [linkingCursor, setLinkingCursor] = useState<{ x: number; y: number } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (flowId) {
      loadFlowData();
    }
  }, [flowId]);

  async function loadFlowData() {
    try {
      setLoading(true);
      // 1. Fetch flow metadata
      const { data: flowData, error: flowErr } = await supabase
        .from('dm_flows')
        .select('*')
        .eq('id', flowId)
        .single();

      if (flowErr || !flowData) throw new Error('Flow not found');
      setFlow(flowData);

      // 2. Fetch flow nodes
      const { data: nodesData, error: nodesErr } = await supabase
        .from('dm_flow_nodes')
        .select('*')
        .eq('flow_id', flowId);

      if (nodesErr) throw nodesErr;

      // Ensure nodes have positions
      const formattedNodes: FlowNode[] = (nodesData || []).map(node => ({
        ...node,
        position: node.position || { x: 100, y: 100 }
      }));
      setNodes(formattedNodes);

      // 3. Fetch flow edges
      const { data: edgesData, error: edgesErr } = await supabase
        .from('dm_flow_edges')
        .select('*')
        .eq('flow_id', flowId);

      if (edgesErr) throw edgesErr;
      setEdges((edgesData || []) as FlowEdge[]);

      // 4. Fetch active flows for Go-To options
      const { data: otherFlowsData } = await supabase
        .from('dm_flows')
        .select('id, name')
        .eq('is_active', true);
      setOtherFlows(otherFlowsData || []);

    } catch (err: any) {
      toast.error('Failed to load flow: ' + err.message);
      navigate('/flows');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0d0e10', color: 'var(--text-secondary)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div className="animate-spin" style={{ width: '24px', height: '24px', border: '2px solid var(--accent-primary)', borderTopColor: 'transparent', borderRadius: '50%' }}></div>
          <span>Loading flow canvas...</span>
        </div>
      </div>
    );
  }


  // Create a new node on the canvas
  function handleAddNode(type: FlowNode['type']) {
    if (!flowId) return;

    // Place the new node relative to the screen center or slightly offset
    const existingCount = nodes.filter(n => n.type === type).length;
    const offset = existingCount * 25;
    const newNode: FlowNode = {
      id: crypto.randomUUID(),
      flow_id: flowId,
      type,
      position: { x: 150 + offset, y: 150 + offset },
      data: getDefaultDataForType(type)
    };

    setNodes(prev => [...prev, newNode]);
    setSelectedNodeId(newNode.id);
    toast.success(`${type.toUpperCase()} block added. Configure its settings.`);
  }

  function getDefaultDataForType(type: FlowNode['type']): FlowNode['data'] {
    switch (type) {
      case 'message':
        return { text: 'Hello, thank you for reaching out!' };
      case 'interactive':
        return {
          text: 'What are you interested in?',
          buttons: [
            { type: 'postback', title: 'Pricing', payload: 'pricing' },
            { type: 'postback', title: 'Support', payload: 'support' }
          ],
          whatsappType: 'button',
          whatsappButtons: [
            { id: 'pricing', title: 'Pricing' },
            { id: 'support', title: 'Support' }
          ]
        };
      case 'delay':
        return { delaySeconds: 3, delayType: 'short' };
      case 'condition':
        return { conditionKey: 'user_tag', conditionOperator: 'equals', conditionValue: 'vip' };
      case 'action':
        return { actionType: 'add_tag', actionParams: { tag: 'lead' } };
      case 'ai_route':
        return {};
      case 'capture_input':
        return { text: 'What is your email address?', captureKey: 'email', captureType: 'email', validationErrorMessage: 'Invalid email. Please check and reply again.' };
      case 'lead_webhook':
        return { webhookUrl: '' };
      case 'randomizer':
        return {};
      case 'goto_flow':
        return { targetFlowId: '' };
      default:
        return {};
    }
  }

  // Handle Dragging mechanics
  function handleNodeMouseDown(e: React.MouseEvent, nodeId: string) {
    // Only drag with left click
    if (e.button !== 0) return;
    
    // Prevent default browser text selection
    e.preventDefault();

    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    setDraggingNodeId(nodeId);
    setDragOffset({
      x: e.clientX - node.position.x,
      y: e.clientY - node.position.y
    });
    setSelectedNodeId(nodeId);
  }

  function handleCanvasMouseMove(e: React.MouseEvent) {
    if (draggingNodeId) {
      // Update dragged node position
      const newX = Math.max(10, Math.min(2500, e.clientX - dragOffset.x));
      const newY = Math.max(10, Math.min(2500, e.clientY - dragOffset.y));

      setNodes(prev =>
        prev.map(n => (n.id === draggingNodeId ? { ...n, position: { x: newX, y: newY } } : n))
      );
    }

    if (linkingSource && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setLinkingCursor({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  }

  function handleCanvasMouseUp() {
    setDraggingNodeId(null);
  }

  // Handle Edge linking
  function startLinking(nodeId: string, handleId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setLinkingSource({ nodeId, handleId });
      setLinkingCursor({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  }

  function connectToNode(targetNodeId: string) {
    if (!linkingSource || !flowId) return;

    // Check if source and target are the same
    if (linkingSource.nodeId === targetNodeId) {
      toast.error('Cannot link a node to itself.');
      setLinkingSource(null);
      setLinkingCursor(null);
      return;
    }

    // Check if link already exists, if so overwrite target
    const existingEdgeIndex = edges.findIndex(
      e => e.source_node_id === linkingSource.nodeId && e.source_handle === linkingSource.handleId
    );

    const newEdge: FlowEdge = {
      id: crypto.randomUUID(),
      flow_id: flowId,
      source_node_id: linkingSource.nodeId,
      target_node_id: targetNodeId,
      source_handle: linkingSource.handleId
    };

    setEdges(prev => {
      const next = [...prev];
      if (existingEdgeIndex > -1) {
        next[existingEdgeIndex] = newEdge;
      } else {
        next.push(newEdge);
      }
      return next;
    });

    toast.success('Blocks connected successfully!');
    setLinkingSource(null);
    setLinkingCursor(null);
  }

  function deleteEdge(edgeId: string) {
    setEdges(prev => prev.filter(e => e.id !== edgeId));
    toast.success('Connection removed.');
  }

  // Delete node and its associated edges
  function handleDeleteNode(nodeId: string) {
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    setEdges(prev => prev.filter(e => e.source_node_id !== nodeId && e.target_node_id !== nodeId));
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
    }
    toast.success('Block removed from builder.');
  }

  // Update node data fields
  function updateNodeData(nodeId: string, updatedData: Partial<FlowNode['data']>) {
    setNodes(prev =>
      prev.map(n => {
        if (n.id === nodeId) {
          return {
            ...n,
            data: {
              ...n.data,
              ...updatedData
            }
          };
        }
        return n;
      })
    );
  }

  // Save flow diagram to Supabase database (Smart Diff update)
  async function handleSaveFlow() {
    if (!flowId || !flow) return;

    try {
      setSaving(true);
      
      // 1. Validate start node
      const incomingNodeIds = new Set(edges.map(e => e.target_node_id));
      const startingNodes = nodes.filter(n => !incomingNodeIds.has(n.id));
      if (nodes.length > 0 && startingNodes.length === 0) {
        throw new Error('Graph loop detected! Ensure at least one starting block exists (has no incoming links).');
      }

      // 2. Fetch existing nodes to delete obsolete ones
      const { data: dbNodes, error: dbNodesErr } = await supabase
        .from('dm_flow_nodes')
        .select('id')
        .eq('flow_id', flowId);
      
      if (dbNodesErr) throw dbNodesErr;

      const currentNodesIds = new Set(nodes.map(n => n.id));
      const obsoleteNodesIds = (dbNodes || []).map(n => n.id).filter(id => !currentNodesIds.has(id));

      // 3. Delete obsolete nodes
      if (obsoleteNodesIds.length > 0) {
        const { error: delErr } = await supabase
          .from('dm_flow_nodes')
          .delete()
          .in('id', obsoleteNodesIds);
        if (delErr) throw delErr;
      }

      // 4. Upsert nodes
      if (nodes.length > 0) {
        const { error: upsertErr } = await supabase
          .from('dm_flow_nodes')
          .upsert(
            nodes.map(n => ({
              id: n.id,
              flow_id: n.flow_id,
              type: n.type,
              data: n.data,
              position: n.position
            }))
          );
        if (upsertErr) throw upsertErr;
      }

      // 5. Delete all old edges & insert new ones (simplest approach for connections graph)
      const { error: delEdgesErr } = await supabase
        .from('dm_flow_edges')
        .delete()
        .eq('flow_id', flowId);
      
      if (delEdgesErr) throw delEdgesErr;

      if (edges.length > 0) {
        const { error: insEdgesErr } = await supabase
          .from('dm_flow_edges')
          .insert(
            edges.map(e => ({
              id: e.id,
              flow_id: e.flow_id,
              source_node_id: e.source_node_id,
              target_node_id: e.target_node_id,
              source_handle: e.source_handle
            }))
          );
        if (insEdgesErr) throw insEdgesErr;
      }

      // Update flow timestamps
      await supabase.from('dm_flows').update({ updated_at: new Date().toISOString() }).eq('id', flowId);

      toast.success('Flow saved successfully!');
    } catch (err: any) {
      toast.error('Failed to save flow: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleExportJson() {
    if (!flow) return;
    exportFlow(flow, nodes as any, edges as any);
    toast.success('Flow exported successfully!');
  }

  async function handleImportJsonLocal(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      try {
        const data = JSON.parse(content);
        if (!data.nodes || !Array.isArray(data.nodes)) {
          toast.error('Invalid flow file: missing nodes');
          return;
        }

        // Map Node IDs to prevent UUID collisions
        const nodeIdMap: Record<string, string> = {};
        const newNodes = data.nodes.map((node: any) => {
          const freshNodeId = crypto.randomUUID();
          nodeIdMap[node.id] = freshNodeId;
          return {
            id: freshNodeId,
            flow_id: flowId!,
            type: node.type,
            data: node.data || {},
            position: node.position || { x: 100, y: 100 }
          };
        });

        const newEdges = (data.edges || []).map((edge: any) => {
          const sourceId = nodeIdMap[edge.source_node_id];
          const targetId = nodeIdMap[edge.target_node_id];
          if (!sourceId || !targetId) return null;
          return {
            id: crypto.randomUUID(),
            flow_id: flowId!,
            source_node_id: sourceId,
            target_node_id: targetId,
            source_handle: edge.source_handle || null
          };
        }).filter(Boolean);

        setNodes(newNodes);
        setEdges(newEdges as any);
        setSelectedNodeId(null);
        toast.success('Flow JSON loaded onto canvas. Click "Save Flow" to apply changes.');
      } catch (err: any) {
        toast.error('Failed to parse JSON file: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  // Calculate coordinates for drawing SVG connection lines
  // Nodes are 240px wide. Header is 42px high.
  function getNodeHandleCoords(nodeId: string, handleId: string, direction: 'source' | 'target') {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };

    const width = 240;

    if (direction === 'target') {
      // Left Center point
      return {
        x: node.position.x,
        y: node.position.y + 40
      };
    } else {
      // Source Handles are on the right edge
      if (handleId === 'default') {
        return {
          x: node.position.x + width,
          y: node.position.y + 40
        };
      } else if (handleId === 'true') {
        return {
          x: node.position.x + width,
          y: node.position.y + 55
        };
      } else if (handleId === 'false') {
        return {
          x: node.position.x + width,
          y: node.position.y + 85
        };
      } else {
        // Interactive node button handles
        // HandleId is button title or index. Let's find index in data.buttons
        const buttons = node.data.buttons || [];
        const btnIndex = buttons.findIndex(b => (b.payload || b.title) === handleId);
        
        // WhatsApp button handles fallback
        const waButtons = node.data.whatsappButtons || [];
        const waIndex = waButtons.findIndex(b => (b.id || b.title) === handleId);

        const activeIndex = btnIndex > -1 ? btnIndex : (waIndex > -1 ? waIndex : 0);

        return {
          x: node.position.x + width,
          y: node.position.y + 75 + activeIndex * 34
        };
      }
    }
  }

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)', color: '#fff', overflow: 'hidden' }}>
      
      {/* Builder Sub-header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 24px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-primary)',
        zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button className="btn-ghost btn-icon" onClick={() => navigate('/flows')} title="Back to Flows">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>
              {flow?.name || 'Loading Flow...'}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '11px', margin: 0 }}>
              Drag blocks, configure buttons, and link circles to establish DM sequences.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          {/* Quick Toolbar */}
          <div style={{ display: 'inline-flex', gap: '4px', background: 'var(--bg-primary)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)' }}>
            <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: '11px', gap: '4px' }} onClick={() => handleAddNode('message')} title="Add Text Message">
              <MessageSquare size={13} color="#4f46e5" /> +Text
            </button>
            <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: '11px', gap: '4px' }} onClick={() => handleAddNode('interactive')} title="Add Interactive Options">
              <GitPullRequest size={13} color="#d946ef" /> +Interactive
            </button>
            <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: '11px', gap: '4px' }} onClick={() => handleAddNode('delay')} title="Add Time Delay">
              <Clock size={13} color="#f59e0b" /> +Delay
            </button>
            <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: '11px', gap: '4px' }} onClick={() => handleAddNode('condition')} title="Add Conditional Logic">
              <Zap size={13} color="#eab308" /> +Rule
            </button>
            <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: '11px', gap: '4px' }} onClick={() => handleAddNode('action')} title="Add Tag/Attribute Action">
              <Settings size={13} color="#10b981" /> +Action
            </button>
            <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: '11px', gap: '4px' }} onClick={() => handleAddNode('ai_route')} title="Route control to AI Chatbot">
              <Bot size={13} color="#f43f5e" /> +AI
            </button>
            <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: '11px', gap: '4px' }} onClick={() => handleAddNode('capture_input')} title="Capture User Response">
              <User size={13} color="#06b6d4" /> +Capture
            </button>
            <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: '11px', gap: '4px' }} onClick={() => handleAddNode('lead_webhook')} title="Send Lead to Webhook">
              <Share2 size={13} color="#8b5cf6" /> +Webhook
            </button>
            <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: '11px', gap: '4px' }} onClick={() => handleAddNode('randomizer')} title="A/B Split Test Path">
              <Shuffle size={13} color="#ec4899" /> +Split
            </button>
            <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: '11px', gap: '4px' }} onClick={() => handleAddNode('goto_flow')} title="Go to another flow">
              <ArrowRightLeft size={13} color="#3b82f6" /> +Go-To
            </button>
          </div>

          <button className="btn-secondary" onClick={() => document.getElementById('import-builder-json')?.click()} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', fontSize: '13px' }} title="Import Flow JSON directly onto canvas">
            <Upload size={13} />
            Import JSON
          </button>
          <input
            id="import-builder-json"
            type="file"
            accept=".json"
            onChange={handleImportJsonLocal}
            style={{ display: 'none' }}
          />
          <button className="btn-secondary" onClick={handleExportJson} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', fontSize: '13px' }} title="Export Flow config as JSON">
            <Download size={13} />
            Export JSON
          </button>
          <button className="btn-primary" disabled={saving} onClick={handleSaveFlow} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '13px' }}>
            <Save size={14} />
            {saving ? 'Saving...' : 'Save Flow'}
          </button>
        </div>
      </div>

      {/* Main Workspace Area (Canvas + Properties sidebar) */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        
        {/* Canvas Area */}
        <div
          ref={canvasRef}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          style={{
            flex: 1,
            position: 'relative',
            background: '#0d0e10',
            backgroundSize: '24px 24px',
            backgroundImage: 'radial-gradient(circle, #252830 1px, transparent 1px)',
            overflow: 'auto',
            cursor: draggingNodeId ? 'grabbing' : 'default'
          }}
          onClick={() => {
            setSelectedNodeId(null);
            setLinkingSource(null);
            setLinkingCursor(null);
          }}
        >
          {/* SVG Connection Lines Overlay */}
          <svg style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '2500px',
            height: '2500px',
            pointerEvents: 'none',
            zIndex: 10
          }}>
            {/* Draw existing edges */}
            {edges.map(edge => {
              const start = getNodeHandleCoords(edge.source_node_id, edge.source_handle, 'source');
              const end = getNodeHandleCoords(edge.target_node_id, '', 'target');
              
              // Draw smooth bezier curve
              const controlPointX1 = start.x + Math.abs(end.x - start.x) * 0.4;
              const controlPointX2 = end.x - Math.abs(end.x - start.x) * 0.4;
              const d = `M ${start.x} ${start.y} C ${controlPointX1} ${start.y}, ${controlPointX2} ${end.y}, ${end.x} ${end.y}`;

              // Determine edge color based on source handle
              let strokeColor = 'var(--accent-primary)';
              if (edge.source_handle === 'true') strokeColor = 'var(--success)';
              if (edge.source_handle === 'false') strokeColor = 'var(--error)';

              return (
                <g key={edge.id} style={{ pointerEvents: 'auto', cursor: 'pointer' }}>
                  {/* Thick invisible path for easier clicking to delete */}
                  <path
                    d={d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="10"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteEdge(edge.id);
                    }}
                  />
                  {/* Colored visual path */}
                  <path
                    d={d}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    style={{ opacity: 0.85 }}
                  />
                  {/* Small click indicator node on connection */}
                  <circle
                    cx={(start.x + end.x) / 2}
                    cy={(start.y + end.y) / 2}
                    r="9"
                    fill="#151719"
                    stroke={strokeColor}
                    strokeWidth="1.5"
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteEdge(edge.id);
                    }}
                  />
                  <text
                    x={(start.x + end.x) / 2}
                    y={(start.y + end.y) / 2 + 3}
                    fill="var(--error)"
                    fontSize="9px"
                    fontWeight="bold"
                    textAnchor="middle"
                    style={{ cursor: 'pointer', pointerEvents: 'none' }}
                  >
                    ×
                  </text>
                </g>
              );
            })}

            {/* Draw live connecting line when in linking mode */}
            {linkingSource && linkingCursor && (() => {
              const start = getNodeHandleCoords(linkingSource.nodeId, linkingSource.handleId, 'source');
              const d = `M ${start.x} ${start.y} C ${start.x + 80} ${start.y}, ${linkingCursor.x - 80} ${linkingCursor.y}, ${linkingCursor.x} ${linkingCursor.y}`;
              return (
                <path
                  d={d}
                  fill="none"
                  stroke="var(--text-secondary)"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />
              );
            })()}
          </svg>

          {/* Render Flow Nodes */}
          {nodes.map(node => {
            const isSelected = selectedNodeId === node.id;
            const isTargetCandidate = linkingSource && linkingSource.nodeId !== node.id;

            // Header colors by node type
            const colors = {
              message: { border: '#4f46e5', bg: 'rgba(79, 70, 229, 0.12)', label: 'Text Message' },
              interactive: { border: '#d946ef', bg: 'rgba(217, 70, 239, 0.12)', label: 'Interactive Choices' },
              delay: { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', label: 'Typing Delay' },
              condition: { border: '#eab308', bg: 'rgba(234, 179, 8, 0.12)', label: 'Conditional Rule' },
              action: { border: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', label: 'Action Block' },
              ai_route: { border: '#f43f5e', bg: 'rgba(244, 63, 94, 0.12)', label: 'AI Chat Handover' },
              capture_input: { border: '#06b6d4', bg: 'rgba(6, 182, 212, 0.12)', label: 'Capture Input' },
              lead_webhook: { border: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)', label: 'Send Lead (Webhook)' },
              randomizer: { border: '#ec4899', bg: 'rgba(236, 72, 153, 0.12)', label: 'A/B Split Test' },
              goto_flow: { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)', label: 'Go-To Flow' }
            }[node.type];

            return (
              <div
                key={node.id}
                style={{
                  position: 'absolute',
                  left: `${node.position.x}px`,
                  top: `${node.position.y}px`,
                  width: '240px',
                  background: '#15171c',
                  border: isSelected 
                    ? `2px solid ${colors.border}` 
                    : (isTargetCandidate ? '2px dashed var(--accent-primary)' : '1px solid var(--border-primary)'),
                  borderRadius: 'var(--radius-md)',
                  boxShadow: isSelected ? '0 0 12px rgba(79, 70, 229, 0.3)' : 'var(--shadow-md)',
                  zIndex: isSelected ? 30 : 20,
                  transition: 'border-color 0.15s ease'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (linkingSource) {
                    connectToNode(node.id);
                  } else {
                    setSelectedNodeId(node.id);
                  }
                }}
              >
                {/* Node Drag Handle */}
                <div
                  onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                  style={{
                    padding: '8px 12px',
                    borderBottom: '1px solid var(--border-primary)',
                    background: colors.bg,
                    borderTopLeftRadius: 'var(--radius-sm)',
                    borderTopRightRadius: 'var(--radius-sm)',
                    cursor: 'grab',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <span style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', color: colors.border }}>
                    {colors.label}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteNode(node.id);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title="Remove block"
                  >
                    <X size={12} />
                  </button>
                </div>

                {/* Node Body Content Summary */}
                <div style={{ padding: '12px', fontSize: '12px', color: 'var(--text-primary)' }}>
                  
                  {/* Left Incoming Handle Circle */}
                  <div
                    style={{
                      position: 'absolute',
                      left: '-7px',
                      top: '33px',
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: '#252830',
                      border: `2.5px solid ${colors.border}`,
                      zIndex: 35,
                      cursor: isTargetCandidate ? 'pointer' : 'default'
                    }}
                    title="Incoming connection"
                  />

                  {/* Body Content based on block type */}
                  {node.type === 'message' && (
                    <div>
                      <div style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {node.data.text || <span style={{ fontStyle: 'italic', opacity: 0.5 }}>Empty Message</span>}
                      </div>
                      {node.data.mediaUrl && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#252830', padding: '2px 6px', borderRadius: '4px', marginTop: '6px', fontSize: '9px', color: 'var(--accent-primary)' }}>
                          <FileImage size={10} /> Media Attached
                        </div>
                      )}
                      
                      {/* Outgoing Handle default */}
                      <div
                        onClick={(e) => startLinking(node.id, 'default', e)}
                        style={{
                          position: 'absolute',
                          right: '-7px',
                          top: '33px',
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          background: colors.border,
                          border: '2px solid #15171c',
                          zIndex: 35,
                          cursor: 'crosshair'
                        }}
                        title="Link default next step"
                      />
                    </div>
                  )}

                  {node.type === 'interactive' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        {node.data.text || 'Choose Options:'}
                      </div>
                      
                      {/* Choice items */}
                      {(node.data.buttons || []).map((btn, idx) => {
                        const handleName = btn.payload || btn.title;
                        return (
                          <div
                            key={idx}
                            style={{
                              position: 'relative',
                              background: '#252830',
                              border: '1px solid var(--border-primary)',
                              padding: '5px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              textAlign: 'center'
                            }}
                          >
                            {btn.title}
                            {btn.type !== 'web_url' && btn.type !== 'phone_number' && (
                              /* Outgoing handle for each postback button option */
                              <div
                                onClick={(e) => startLinking(node.id, handleName, e)}
                                style={{
                                  position: 'absolute',
                                  right: '-19px',
                                  top: '8px',
                                  width: '12px',
                                  height: '12px',
                                  borderRadius: '50%',
                                  background: colors.border,
                                  border: '2px solid #15171c',
                                  zIndex: 35,
                                  cursor: 'crosshair'
                                }}
                                title={`Link button "${btn.title}"`}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {node.type === 'delay' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={14} color="#f59e0b" />
                      <span>Wait {node.data.delaySeconds || 3} seconds</span>
                      
                      {/* Outgoing Handle */}
                      <div
                        onClick={(e) => startLinking(node.id, 'default', e)}
                        style={{
                          position: 'absolute',
                          right: '-7px',
                          top: '33px',
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          background: colors.border,
                          border: '2px solid #15171c',
                          zIndex: 35,
                          cursor: 'crosshair'
                        }}
                        title="Link next step"
                      />
                    </div>
                  )}

                  {node.type === 'condition' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}>
                      <div style={{ fontSize: '11px', background: '#252830', padding: '4px', borderRadius: '4px', textAlign: 'center', fontFamily: 'monospace' }}>
                        {node.data.conditionKey || 'attribute'} {node.data.conditionOperator === 'contains' ? 'contains' : (node.data.conditionOperator === 'exists' ? 'exists' : '=')} {node.data.conditionOperator !== 'exists' ? `"${node.data.conditionValue}"` : ''}
                      </div>

                      {/* True / False outlets */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                        <div style={{ position: 'relative', fontSize: '10px', color: 'var(--success)', fontWeight: 'bold', height: '24px', display: 'flex', alignItems: 'center' }}>
                          TRUE
                          <div
                            onClick={(e) => startLinking(node.id, 'true', e)}
                            style={{
                              position: 'absolute',
                              right: '-19px',
                              width: '12px',
                              height: '12px',
                              borderRadius: '50%',
                              background: 'var(--success)',
                              border: '2px solid #15171c',
                              zIndex: 35,
                              cursor: 'crosshair'
                            }}
                            title="If logic matches"
                          />
                        </div>
                        <div style={{ position: 'relative', fontSize: '10px', color: 'var(--error)', fontWeight: 'bold', height: '24px', display: 'flex', alignItems: 'center' }}>
                          FALSE
                          <div
                            onClick={(e) => startLinking(node.id, 'false', e)}
                            style={{
                              position: 'absolute',
                              right: '-19px',
                              width: '12px',
                              height: '12px',
                              borderRadius: '50%',
                              background: 'var(--error)',
                              border: '2px solid #15171c',
                              zIndex: 35,
                              cursor: 'crosshair'
                            }}
                            title="If logic fails"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {node.type === 'action' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ textTransform: 'capitalize', fontWeight: 'semibold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Settings size={12} color="#10b981" />
                        {node.data.actionType?.replace('_', ' ') || 'Action'}
                      </div>
                      
                      {node.data.actionType === 'set_attribute' && node.data.actionParams && (
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                          {node.data.actionParams.key} = {node.data.actionParams.value}
                        </div>
                      )}

                      {/* Outgoing Handle */}
                      <div
                        onClick={(e) => startLinking(node.id, 'default', e)}
                        style={{
                          position: 'absolute',
                          right: '-7px',
                          top: '33px',
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          background: colors.border,
                          border: '2px solid #15171c',
                          zIndex: 35,
                          cursor: 'crosshair'
                        }}
                        title="Link next step"
                      />
                    </div>
                  )}

                  {node.type === 'ai_route' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.8 }}>
                      <Bot size={14} color="#f43f5e" />
                      <span>Resume Chatbot Control</span>
                      {/* AI Route has no outgoing connections as it returns control back to the AI */}
                    </div>
                  )}

                  {node.type === 'capture_input' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '11px', color: 'var(--text-secondary)' }}>
                        Save to variable: <span style={{ fontFamily: 'monospace', color: 'var(--accent-primary)' }}>{node.data.captureKey || 'input'}</span>
                      </div>
                      <div style={{ fontSize: '10px', opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        Prompt: "{node.data.text || 'Type value...'}"
                      </div>
                      {/* Outgoing Handle */}
                      <div
                        onClick={(e) => startLinking(node.id, 'default', e)}
                        style={{
                          position: 'absolute',
                          right: '-7px',
                          top: '33px',
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          background: colors.border,
                          border: '2px solid #15171c',
                          zIndex: 35,
                          cursor: 'crosshair'
                        }}
                        title="Link next step"
                      />
                    </div>
                  )}

                  {node.type === 'lead_webhook' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '11px', color: 'var(--text-secondary)' }}>
                        Send Lead info
                      </div>
                      <div style={{ fontSize: '9px', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {node.data.webhookUrl || 'No Webhook URL'}
                      </div>
                      {/* Outgoing Handle */}
                      <div
                        onClick={(e) => startLinking(node.id, 'default', e)}
                        style={{
                          position: 'absolute',
                          right: '-7px',
                          top: '33px',
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          background: colors.border,
                          border: '2px solid #15171c',
                          zIndex: 35,
                          cursor: 'crosshair'
                        }}
                        title="Link next step"
                      />
                    </div>
                  )}

                  {node.type === 'randomizer' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '11px', color: 'var(--text-secondary)' }}>
                        Split Test Leads
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                        <div style={{ position: 'relative', fontSize: '10px', color: 'var(--accent-primary)', fontWeight: 'bold', height: '22px', display: 'flex', alignItems: 'center' }}>
                          PATH A (50%)
                          <div
                            onClick={(e) => startLinking(node.id, 'path_a', e)}
                            style={{
                              position: 'absolute',
                              right: '-19px',
                              width: '12px',
                              height: '12px',
                              borderRadius: '50%',
                              background: colors.border,
                              border: '2px solid #15171c',
                              zIndex: 35,
                              cursor: 'crosshair'
                            }}
                            title="Path A"
                          />
                        </div>
                        <div style={{ position: 'relative', fontSize: '10px', color: 'var(--accent-primary)', fontWeight: 'bold', height: '22px', display: 'flex', alignItems: 'center' }}>
                          PATH B (50%)
                          <div
                            onClick={(e) => startLinking(node.id, 'path_b', e)}
                            style={{
                              position: 'absolute',
                              right: '-19px',
                              width: '12px',
                              height: '12px',
                              borderRadius: '50%',
                              background: colors.border,
                              border: '2px solid #15171c',
                              zIndex: 35,
                              cursor: 'crosshair'
                            }}
                            title="Path B"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {node.type === 'goto_flow' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '11px', color: 'var(--text-secondary)' }}>
                        Jump to Flow
                      </div>
                      <div style={{ fontSize: '10px', opacity: 0.8, color: 'var(--accent-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {otherFlows.find(f => f.id === node.data.targetFlowId)?.name || 'Select Flow...'}
                      </div>
                    </div>
                  )}

                </div>
              </div>
            );
          })}
        </div>

        {/* Sidebar Configuration Panel */}
        <div style={{
          width: '320px',
          background: 'var(--bg-secondary)',
          borderLeft: '1px solid var(--border-primary)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          zIndex: 40
        }}>
          {selectedNode ? (
            <div style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 'bold', margin: 0, textTransform: 'capitalize' }}>
                  {selectedNode.type} Options
                </h3>
                <button
                  className="btn-ghost btn-icon"
                  style={{ color: 'var(--error)' }}
                  onClick={() => handleDeleteNode(selectedNode.id)}
                  title="Delete Block"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Form tailored to node type */}
              {selectedNode.type === 'message' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>MESSAGE CONTENT</label>
                    <textarea
                      value={selectedNode.data.text || ''}
                      onChange={e => updateNodeData(selectedNode.id, { text: e.target.value })}
                      rows={5}
                      placeholder="Type the message that will be sent..."
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 'var(--radius-md)',
                        color: '#fff',
                        fontSize: '13px',
                        resize: 'none'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>ATTACH IMAGE/MEDIA (OPTIONAL)</label>
                    <AssetSelector
                      selectedUrl={selectedNode.data.mediaUrl}
                      onSelect={(url, type) => updateNodeData(selectedNode.id, { mediaUrl: url || undefined, mediaType: type })}
                    />
                    {selectedNode.data.mediaUrl && (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          Selected: {selectedNode.data.mediaUrl}
                        </span>
                        <button 
                          type="button" 
                          className="btn-ghost" 
                          onClick={() => updateNodeData(selectedNode.id, { mediaUrl: undefined, mediaType: undefined })}
                          style={{ fontSize: '10px', color: 'var(--error)', padding: '2px 6px' }}
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedNode.type === 'interactive' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>BODY TEXT</label>
                    <textarea
                      value={selectedNode.data.text || ''}
                      onChange={e => updateNodeData(selectedNode.id, { text: e.target.value })}
                      rows={3}
                      placeholder="Question or description text..."
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 'var(--radius-md)',
                        color: '#fff',
                        fontSize: '13px',
                        resize: 'none'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>HEADER IMAGE (OPTIONAL)</label>
                    <AssetSelector
                      selectedUrl={selectedNode.data.mediaUrl}
                      onSelect={(url, type) => updateNodeData(selectedNode.id, { mediaUrl: url || undefined, mediaType: type })}
                    />
                    {selectedNode.data.mediaUrl && (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          Selected: {selectedNode.data.mediaUrl}
                        </span>
                        <button 
                          type="button" 
                          className="btn-ghost" 
                          onClick={() => updateNodeData(selectedNode.id, { mediaUrl: undefined, mediaType: undefined })}
                          style={{ fontSize: '10px', color: 'var(--error)', padding: '2px 6px' }}
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>MESSENGER BUTTONS (MAX 3)</label>
                      {(selectedNode.data.buttons || []).length < 3 && (
                        <button
                          type="button"
                          className="btn-ghost"
                          style={{ padding: '2px 6px', fontSize: '10px' }}
                          onClick={() => {
                            const btns = [...(selectedNode.data.buttons || [])];
                            btns.push({ type: 'postback', title: `Option ${btns.length + 1}`, payload: `option_${btns.length + 1}` });
                            updateNodeData(selectedNode.id, { buttons: btns });
                          }}
                        >
                          + Add
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {(selectedNode.data.buttons || []).map((btn, idx) => (
                        <div key={idx} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', padding: '8px', borderRadius: 'var(--radius-sm)' }}>
                          <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                            <input
                              type="text"
                              value={btn.title}
                              placeholder="Button text"
                              onChange={e => {
                                const btns = [...(selectedNode.data.buttons || [])];
                                btns[idx] = { ...btns[idx], title: e.target.value };
                                updateNodeData(selectedNode.id, { buttons: btns });
                              }}
                              style={{ flex: 1, padding: '4px 6px', fontSize: '11px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: '#fff', borderRadius: '3px' }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const btns = (selectedNode.data.buttons || []).filter((_, i) => i !== idx);
                                updateNodeData(selectedNode.id, { buttons: btns });
                              }}
                              style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}
                            >
                              <X size={12} />
                            </button>
                          </div>
                          
                          <select
                            value={btn.type}
                            onChange={e => {
                              const btns = [...(selectedNode.data.buttons || [])];
                              btns[idx] = { ...btns[idx], type: e.target.value as any };
                              updateNodeData(selectedNode.id, { buttons: btns });
                            }}
                            style={{ width: '100%', padding: '4px 6px', fontSize: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: '#fff', borderRadius: '3px', marginBottom: '4px' }}
                          >
                            <option value="postback">Postback (Next step link)</option>
                            <option value="web_url">Open Web URL</option>
                            <option value="phone_number">Call Phone Number</option>
                          </select>

                          {btn.type === 'web_url' ? (
                            <input
                              type="text"
                              value={btn.url || ''}
                              placeholder="https://example.com"
                              onChange={e => {
                                const btns = [...(selectedNode.data.buttons || [])];
                                btns[idx] = { ...btns[idx], url: e.target.value };
                                updateNodeData(selectedNode.id, { buttons: btns });
                              }}
                              style={{ width: '100%', padding: '4px 6px', fontSize: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: '#fff', borderRadius: '3px' }}
                            />
                          ) : (
                            <input
                              type="text"
                              value={btn.payload || ''}
                              placeholder="Postback payload / value"
                              onChange={e => {
                                const btns = [...(selectedNode.data.buttons || [])];
                                btns[idx] = { ...btns[idx], payload: e.target.value };
                                updateNodeData(selectedNode.id, { buttons: btns });
                              }}
                              style={{ width: '100%', padding: '4px 6px', fontSize: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: '#fff', borderRadius: '3px' }}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {selectedNode.type === 'delay' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>WAIT DURATION (SECONDS)</label>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={selectedNode.data.delaySeconds || 3}
                      onChange={e => updateNodeData(selectedNode.id, { delaySeconds: parseInt(e.target.value) || 3 })}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 'var(--radius-md)',
                        color: '#fff',
                        fontSize: '13px'
                      }}
                    />
                    <p style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                      While the delay runs, a simulated "typing indicator" is displayed to the user in Messenger or Instagram to make it feel human.
                    </p>
                  </div>
                </div>
              )}

              {selectedNode.type === 'condition' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>ATTRIBUTE / KEY</label>
                    <input
                      type="text"
                      placeholder="e.g. user_tag or first_name"
                      value={selectedNode.data.conditionKey || ''}
                      onChange={e => updateNodeData(selectedNode.id, { conditionKey: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 'var(--radius-md)',
                        color: '#fff',
                        fontSize: '13px'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>OPERATOR</label>
                    <select
                      value={selectedNode.data.conditionOperator || 'equals'}
                      onChange={e => updateNodeData(selectedNode.id, { conditionOperator: e.target.value as any })}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 'var(--radius-md)',
                        color: '#fff',
                        fontSize: '13px'
                      }}
                    >
                      <option value="equals">Equals</option>
                      <option value="contains">Contains</option>
                      <option value="exists">Exists (Has any value)</option>
                    </select>
                  </div>

                  {selectedNode.data.conditionOperator !== 'exists' && (
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>MATCHING VALUE</label>
                      <input
                        type="text"
                        placeholder="e.g. vip"
                        value={selectedNode.data.conditionValue || ''}
                        onChange={e => updateNodeData(selectedNode.id, { conditionValue: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          background: 'var(--bg-primary)',
                          border: '1px solid var(--border-primary)',
                          borderRadius: 'var(--radius-md)',
                          color: '#fff',
                          fontSize: '13px'
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              {selectedNode.type === 'action' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>ACTION TYPE</label>
                    <select
                      value={selectedNode.data.actionType || 'add_tag'}
                      onChange={e => {
                        const type = e.target.value as any;
                        updateNodeData(selectedNode.id, {
                          actionType: type,
                          actionParams: type === 'set_attribute' ? { key: 'attribute', value: '' } : { tag: '' }
                        });
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 'var(--radius-md)',
                        color: '#fff',
                        fontSize: '13px'
                      }}
                    >
                      <option value="add_tag">Add Tag</option>
                      <option value="remove_tag">Remove Tag</option>
                      <option value="set_attribute">Set Custom Attribute</option>
                      <option value="pause_bot">Pause AI Chatbot</option>
                      <option value="resume_bot">Resume AI Chatbot</option>
                    </select>
                  </div>

                  {selectedNode.data.actionType === 'set_attribute' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder="Key"
                        value={selectedNode.data.actionParams?.key || ''}
                        onChange={e => updateNodeData(selectedNode.id, { actionParams: { ...selectedNode.data.actionParams, key: e.target.value } })}
                        style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', color: '#fff', borderRadius: 'var(--radius-md)', fontSize: '12px' }}
                      />
                      <input
                        type="text"
                        placeholder="Value"
                        value={selectedNode.data.actionParams?.value || ''}
                        onChange={e => updateNodeData(selectedNode.id, { actionParams: { ...selectedNode.data.actionParams, value: e.target.value } })}
                        style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', color: '#fff', borderRadius: 'var(--radius-md)', fontSize: '12px' }}
                      />
                    </div>
                  )}

                  {(selectedNode.data.actionType === 'add_tag' || selectedNode.data.actionType === 'remove_tag') && (
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>TAG NAME</label>
                      <input
                        type="text"
                        placeholder="e.g. lead_qualified"
                        value={selectedNode.data.actionParams?.tag || ''}
                        onChange={e => updateNodeData(selectedNode.id, { actionParams: { tag: e.target.value } })}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          background: 'var(--bg-primary)',
                          border: '1px solid var(--border-primary)',
                          borderRadius: 'var(--radius-md)',
                          color: '#fff',
                          fontSize: '13px'
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              {selectedNode.type === 'ai_route' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', opacity: 0.85 }}>
                  <AlertCircle size={28} color="#f43f5e" />
                  <div style={{ fontSize: '12px', lineHeight: '1.5' }}>
                    This block exits the sequence flow and hands conversational control back to your standard AI chatbot agent.
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    Note: If you don't connect a block to anything, it will automatically complete and resume standard chatbot control by default.
                  </div>
                </div>
              )}

              {selectedNode.type === 'capture_input' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>VARIABLE KEY (AUTO-SAVES TO USER PROFILE)</label>
                    <input
                      type="text"
                      placeholder="e.g. email or whatsapp_num"
                      value={selectedNode.data.captureKey || ''}
                      onChange={e => updateNodeData(selectedNode.id, { captureKey: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 'var(--radius-md)',
                        color: '#fff',
                        fontSize: '13px'
                      }}
                    />
                    <p style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Lowercase letters, numbers, and underscores only.
                    </p>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>VALIDATION TYPE</label>
                    <select
                      value={selectedNode.data.captureType || 'text'}
                      onChange={e => updateNodeData(selectedNode.id, { captureType: e.target.value as any })}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 'var(--radius-md)',
                        color: '#fff',
                        fontSize: '13px'
                      }}
                    >
                      <option value="text">Any Text (No Validation)</option>
                      <option value="email">Email Address</option>
                      <option value="phone">Phone Number</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>QUESTION PROMPT TEXT</label>
                    <textarea
                      value={selectedNode.data.text || ''}
                      onChange={e => updateNodeData(selectedNode.id, { text: e.target.value })}
                      rows={3}
                      placeholder="e.g. Please reply with your email address:"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 'var(--radius-md)',
                        color: '#fff',
                        fontSize: '13px',
                        resize: 'none'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>VALIDATION ERROR MESSAGE</label>
                    <input
                      type="text"
                      placeholder="e.g. That doesn't look like a valid email. Please try again:"
                      value={selectedNode.data.validationErrorMessage || ''}
                      onChange={e => updateNodeData(selectedNode.id, { validationErrorMessage: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 'var(--radius-md)',
                        color: '#fff',
                        fontSize: '13px'
                      }}
                    />
                  </div>
                </div>
              )}

              {selectedNode.type === 'lead_webhook' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>ZAPIER / MAKE WEBHOOK URL</label>
                    <input
                      type="url"
                      placeholder="https://hooks.zapier.com/hooks/catch/..."
                      value={selectedNode.data.webhookUrl || ''}
                      onChange={e => updateNodeData(selectedNode.id, { webhookUrl: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 'var(--radius-md)',
                        color: '#fff',
                        fontSize: '13px'
                      }}
                    />
                    <p style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: '1.4' }}>
                      When a lead reaches this block, the engine will POST a standard profile payload (name, platform, phone, email, choices) directly to this webhook.
                    </p>
                  </div>
                </div>
              )}

              {selectedNode.type === 'randomizer' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', opacity: 0.85 }}>
                  <Shuffle size={28} color="#ec4899" />
                  <div style={{ fontSize: '12px', lineHeight: '1.5' }}>
                    This block splits your audience randomly in a 50/50 ratio. Half the users flow down **Path A**, and half flow down **Path B**.
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    Use this to A/B test different marketing copy, offers, or sequences to see which has a higher conversion rate.
                  </div>
                </div>
              )}

              {selectedNode.type === 'goto_flow' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>SELECT TARGET FLOW</label>
                    <select
                      value={selectedNode.data.targetFlowId || ''}
                      onChange={e => updateNodeData(selectedNode.id, { targetFlowId: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 'var(--radius-md)',
                        color: '#fff',
                        fontSize: '13px'
                      }}
                    >
                      <option value="">-- Select Target Flow --</option>
                      {otherFlows.filter(f => f.id !== flowId).map(f => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                    <p style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: '1.4' }}>
                      Transitions execution instantly from this block into the selected flow's starting block.
                    </p>
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <HelpCircle size={32} style={{ opacity: 0.5, marginBottom: '12px' }} />
              <div style={{ fontSize: '13px', fontWeight: 'semibold', color: '#fff' }}>No Block Selected</div>
              <p style={{ fontSize: '11px', marginTop: '4px', lineHeight: '1.5' }}>
                Click on any block's header to configure its parameters and details here.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
