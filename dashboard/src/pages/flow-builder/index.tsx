// ─── Flow Builder Page (Main Orchestrator) ─────────────────────────────────
// Responsibilities:
//   1. Load flow data from Supabase
//   2. Manage canvas state (nodes, edges, drag, linking)
//   3. Coordinate context menu (right-click)
//   4. Save flow + sync trigger nodes to chat_rules / comment_rules
//   5. Compose sub-components: NodeComponent, ContextMenu, SettingsPanel
//
// IMPORTANT: This file must stay under ~350 lines. If you need to add logic,
// extract it into a dedicated helper file in this directory first.
// ───────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Save, ArrowLeft, Plus, ChevronDown, MoreHorizontal,
  MessageSquare, GitPullRequest, User, Clock, Zap, Bot,
  Share2, Shuffle, ArrowRightLeft, Sparkles, Upload, Download, Settings, BrainCircuit
} from 'lucide-react';

import { supabase } from '../../lib/supabase';
import { toast } from '../../hooks/useToast';
import { exportFlow } from '../../lib/FlowJsonHandler';

import type {
  Flow, FlowNode, FlowEdge, ContextMenuState, LinkingSource, FlowNodeType,
} from './types';
import { getDefaultDataForType } from './nodeConfig';
import NodeComponent from './NodeComponent';
import ContextMenu from './ContextMenu';
import SettingsPanel from './SettingsPanel';

// ─── Canvas scroll-space dimensions ────────────────────────────────────────
const CANVAS_W = 2500;
const CANVAS_H = 2500;
const NODE_W = 240;

export default function FlowBuilderPage() {
  const { flowId } = useParams<{ flowId: string }>();
  const navigate = useNavigate();

  // ── Data state ─────────────────────────────────────────────────────────
  const [flow, setFlow] = useState<Flow | null>(null);
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<FlowEdge[]>([]);
  const [otherFlows, setOtherFlows] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ── UI state ───────────────────────────────────────────────────────────
  const [addBlockOpen, setAddBlockOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // ── Canvas drag & Zoom/Pan state ───────────────────────────────────────
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [dragStartMouse, setDragStartMouse] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [linkingSource, setLinkingSource] = useState<LinkingSource | null>(null);
  const [linkingCursor, setLinkingCursor] = useState<{ x: number; y: number } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);

  const stateRef = useRef({ zoom, panOffset });
  useEffect(() => {
    stateRef.current = { zoom, panOffset };
  }, [zoom, panOffset]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { zoom: currentZoom, panOffset: currentPan } = stateRef.current;

      if (e.ctrlKey) {
        // Pinch zoom
        const zoomFactor = 0.01;
        const delta = -e.deltaY * zoomFactor;
        const newZoom = Math.max(0.5, Math.min(2.0, currentZoom + delta));

        if (newZoom !== currentZoom) {
          const rect = canvas.getBoundingClientRect();
          const mx = e.clientX - rect.left;
          const my = e.clientY - rect.top;

          const cx = (mx - currentPan.x) / currentZoom;
          const cy = (my - currentPan.y) / currentZoom;

          setZoom(newZoom);
          setPanOffset({
            x: mx - cx * newZoom,
            y: my - cy * newZoom
          });
        }
      } else {
        // Panning (two-finger scroll or wheel)
        setPanOffset({
          x: currentPan.x - e.deltaX,
          y: currentPan.y - e.deltaY
        });
      }
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [loading]);

  const handleZoomButton = (factor: number) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mx = rect.width / 2;
    const my = rect.height / 2;

    const currentZoom = stateRef.current.zoom;
    const currentPan = stateRef.current.panOffset;
    const newZoom = Math.max(0.5, Math.min(2.0, currentZoom + factor));
    if (newZoom === currentZoom) return;

    const cx = (mx - currentPan.x) / currentZoom;
    const cy = (my - currentPan.y) / currentZoom;

    setZoom(newZoom);
    setPanOffset({
      x: mx - cx * newZoom,
      y: my - cy * newZoom
    });
  };

  // ── Derived ────────────────────────────────────────────────────────────
  const selectedNode = nodes.find(n => n.id === selectedNodeId) ?? null;

  // ─── Load ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (flowId) loadFlowData();
  }, [flowId]);

  useEffect(() => {
    const handle = () => { if (flowId) loadFlowData(); };
    window.addEventListener('agent-data-updated', handle);
    return () => window.removeEventListener('agent-data-updated', handle);
  }, [flowId]);

  async function loadFlowData() {
    try {
      setLoading(true);
      const [flowRes, nodesRes, edgesRes, otherRes, chatRulesRes, commentRulesRes] = await Promise.all([
        supabase.from('dm_flows').select('*').eq('id', flowId).single(),
        supabase.from('dm_flow_nodes').select('*').eq('flow_id', flowId),
        supabase.from('dm_flow_edges').select('*').eq('flow_id', flowId),
        supabase.from('dm_flows').select('id, name').eq('is_active', true),
        supabase.from('chat_rules').select('id, page_connection_id').eq('dm_flow_id', flowId),
        supabase.from('comment_rules').select('id, page_connection_id').eq('dm_flow_id', flowId),
      ]);

      if (flowRes.error || !flowRes.data) throw new Error('Flow not found');
      setFlow(flowRes.data);

      const pageConnMap = new Map<string, string>();
      (chatRulesRes.data ?? []).forEach(r => {
        if (r.page_connection_id) pageConnMap.set(r.id, r.page_connection_id);
      });
      (commentRulesRes.data ?? []).forEach(r => {
        if (r.page_connection_id) pageConnMap.set(r.id, r.page_connection_id);
      });

      setNodes(
        (nodesRes.data ?? []).map(n => {
          const nodeData = n.data ?? {};
          if (n.type === 'trigger' && !nodeData.triggerPageConnectionId) {
            const pageId = pageConnMap.get(n.id);
            if (pageId) {
              nodeData.triggerPageConnectionId = pageId;
            }
          }
          return {
            ...n,
            position: n.position ?? { x: 100, y: 100 },
            data: nodeData,
          };
        }) as FlowNode[]
      );
      setEdges((edgesRes.data ?? []) as FlowEdge[]);
      setOtherFlows(otherRes.data ?? []);
    } catch (err: any) {
      toast.error('Failed to load flow: ' + err.message);
      navigate('/flows');
    } finally {
      setLoading(false);
    }
  }

  // ─── Add node ──────────────────────────────────────────────────────────
  function handleAddNode(type: FlowNodeType) {
    if (!flowId) return;

    // Cascading offset based on TOTAL node count → never overlaps
    const totalCount = nodes.length;
    const col = totalCount % 5;
    const row = Math.floor(totalCount / 5);
    const newNode: FlowNode = {
      id: crypto.randomUUID(),
      flow_id: flowId,
      type,
      position: { x: 160 + col * 280, y: 140 + row * 200 },
      data: getDefaultDataForType(type),
    };

    setNodes(prev => [...prev, newNode]);
    setSelectedNodeId(newNode.id);
    setAddBlockOpen(false);
    toast.success(`${type.replace(/_/g, ' ')} block added.`);
  }

  // ─── Drag & Panning mechanics ──────────────────────────────────────────
  function handleNodeMouseDown(e: React.MouseEvent, nodeId: string) {
    if (e.button !== 0) return;
    e.stopPropagation();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    setDraggingNodeId(nodeId);
    setDragStartPos({ x: node.position.x, y: node.position.y });
    setDragStartMouse({ x: e.clientX, y: e.clientY });
    setSelectedNodeId(nodeId);
  }

  function handleCanvasMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    if (e.target === canvasRef.current || (e.target as HTMLElement).tagName === 'svg') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      setContextMenu(null);
    }
  }

  function handleCanvasMouseMove(e: React.MouseEvent) {
    if (draggingNodeId) {
      const deltaX = (e.clientX - dragStartMouse.x) / zoom;
      const deltaY = (e.clientY - dragStartMouse.y) / zoom;
      const newX = Math.max(10, Math.min(CANVAS_W - NODE_W - 10, dragStartPos.x + deltaX));
      const newY = Math.max(10, Math.min(CANVAS_H - 10, dragStartPos.y + deltaY));
      setNodes(prev =>
        prev.map(n => (n.id === draggingNodeId ? { ...n, position: { x: newX, y: newY } } : n))
      );
    }
    if (isPanning) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }
    if (linkingSource && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setLinkingCursor({
        x: (e.clientX - rect.left) / zoom - panOffset.x,
        y: (e.clientY - rect.top) / zoom - panOffset.y
      });
    }
  }

  // ─── Edge linking ─────────────────────────────────────────────────────
  function startLinking(nodeId: string, handleId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setLinkingSource({ nodeId, handleId });
    setLinkingCursor({
      x: (e.clientX - rect.left) / zoom - panOffset.x,
      y: (e.clientY - rect.top) / zoom - panOffset.y
    });
  }

  function connectToNode(targetNodeId: string) {
    if (!linkingSource || !flowId) return;
    if (linkingSource.nodeId === targetNodeId) {
      toast.error('Cannot link a node to itself.');
      setLinkingSource(null);
      setLinkingCursor(null);
      return;
    }
    const existingIdx = edges.findIndex(
      e => e.source_node_id === linkingSource.nodeId && e.source_handle === linkingSource.handleId
    );
    const newEdge: FlowEdge = {
      id: crypto.randomUUID(),
      flow_id: flowId,
      source_node_id: linkingSource.nodeId,
      target_node_id: targetNodeId,
      source_handle: linkingSource.handleId,
    };
    setEdges(prev => {
      const next = [...prev];
      if (existingIdx > -1) next[existingIdx] = newEdge;
      else next.push(newEdge);
      return next;
    });
    toast.success('Blocks connected!');
    setLinkingSource(null);
    setLinkingCursor(null);
  }

  function deleteEdge(edgeId: string) {
    setEdges(prev => prev.filter(e => e.id !== edgeId));
  }

  // ─── Node ops ─────────────────────────────────────────────────────────
  function handleDeleteNode(nodeId: string) {
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    setEdges(prev => prev.filter(e => e.source_node_id !== nodeId && e.target_node_id !== nodeId));
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
    toast.success('Block removed.');
  }

  function handleAutoAlign() {
    if (nodes.length === 0) return;

    // 1. Build adjacency list
    const adj: Record<string, string[]> = {};
    const incoming: Record<string, number> = {};

    nodes.forEach(n => {
      adj[n.id] = [];
      incoming[n.id] = 0;
    });

    edges.forEach(e => {
      if (adj[e.source_node_id] && adj[e.target_node_id]) {
        adj[e.source_node_id].push(e.target_node_id);
        incoming[e.target_node_id]++;
      }
    });

    // 2. Find start nodes (prefer triggers)
    let startNodes = nodes.filter(n => n.type === 'trigger');
    if (startNodes.length === 0) {
      startNodes = nodes.filter(n => incoming[n.id] === 0);
    }
    if (startNodes.length === 0) {
      startNodes = [nodes[0]];
    }

    // 3. Assign layers using BFS
    const nodeLayers: Record<string, number> = {};
    const queue: { id: string; layer: number }[] = [];

    startNodes.forEach(n => {
      queue.push({ id: n.id, layer: 0 });
      nodeLayers[n.id] = 0;
    });

    while (queue.length > 0) {
      const curr = queue.shift()!;
      const neighbors = adj[curr.id] || [];
      for (const nextId of neighbors) {
        const nextLayer = curr.layer + 1;
        if (nodeLayers[nextId] === undefined || nodeLayers[nextId] < nextLayer) {
          nodeLayers[nextId] = nextLayer;
          queue.push({ id: nextId, layer: nextLayer });
        }
      }
    }

    // Lay unvisited nodes in layer 0
    nodes.forEach(n => {
      if (nodeLayers[n.id] === undefined) {
        nodeLayers[n.id] = 0;
      }
    });

    // 4. Group by layer
    const layers: Record<number, string[]> = {};
    nodes.forEach(n => {
      const l = nodeLayers[n.id];
      if (!layers[l]) layers[l] = [];
      if (!layers[l].includes(n.id)) {
        layers[l].push(n.id);
      }
    });

    // 5. Reposition
    const startX = 80;
    const startY = 120;
    const colWidth = 350;
    const rowHeight = 220;

    const newNodes = nodes.map(n => {
      const l = nodeLayers[n.id];
      const idx = (layers[l] || []).indexOf(n.id);
      
      const x = startX + l * colWidth;
      const y = startY + idx * rowHeight;
      return {
        ...n,
        position: { x, y }
      };
    });

    setNodes(newNodes);
    toast.success('Blocks aligned automatically!');
  }

  function handleDuplicateNode(nodeId: string) {
    const source = nodes.find(n => n.id === nodeId);
    if (!source || !flowId) return;
    const clone: FlowNode = {
      ...source,
      id: crypto.randomUUID(),
      flow_id: flowId,
      position: { x: source.position.x + 60, y: source.position.y + 60 },
      data: { ...source.data },
    };
    setNodes(prev => [...prev, clone]);
    setSelectedNodeId(clone.id);
    toast.success('Block duplicated!');
  }

  function updateNodeData(nodeId: string, patch: Partial<FlowNode['data']>) {
    setNodes(prev =>
      prev.map(n => (n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n))
    );
  }

  // ─── Context menu ─────────────────────────────────────────────────────
  function handleContextMenu(e: React.MouseEvent, nodeId: string) {
    setContextMenu({ nodeId, x: e.clientX, y: e.clientY });
  }

  // ─── Handle coordinate helper ─────────────────────────────────────────
  function getNodeHandleCoords(nodeId: string, handleId: string, direction: 'source' | 'target') {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };
    if (direction === 'target') return { x: node.position.x, y: node.position.y + 40 };
    if (handleId === 'default') return { x: node.position.x + NODE_W, y: node.position.y + 40 };
    if (handleId === 'true')   return { x: node.position.x + NODE_W, y: node.position.y + 55 };
    if (handleId === 'false')  return { x: node.position.x + NODE_W, y: node.position.y + 85 };
    // Search Messenger buttons first, then WhatsApp buttons as fallback
    const btnIdx = (node.data.buttons ?? []).findIndex(b => (b.payload || b.title) === handleId);
    if (btnIdx > -1) return { x: node.position.x + NODE_W, y: node.position.y + 75 + btnIdx * 34 };
    const waIdx = (node.data.whatsappButtons ?? []).findIndex(b => (b.id || b.title) === handleId);
    const activeIdx = waIdx > -1 ? waIdx : 0;
    return { x: node.position.x + NODE_W, y: node.position.y + 75 + activeIdx * 34 };
  }

  // ─── Save ─────────────────────────────────────────────────────────────
  async function handleSaveFlow() {
    if (!flowId || !flow) return;
    try {
      setSaving(true);

      // 1. Validate: no disconnected loops
      const incomingIds = new Set(edges.map(e => e.target_node_id));
      const startNodes = nodes.filter(n => !incomingIds.has(n.id));
      if (nodes.length > 0 && startNodes.length === 0) {
        throw new Error('Graph loop detected! Ensure at least one starting block with no incoming links.');
      }

      // 2. Fetch obsolete nodes from DB
      const { data: dbNodes } = await supabase.from('dm_flow_nodes').select('id').eq('flow_id', flowId);
      const currentIds = new Set(nodes.map(n => n.id));
      const obsoleteIds = (dbNodes ?? []).map(n => n.id).filter(id => !currentIds.has(id));
      if (obsoleteIds.length > 0) {
        await supabase.from('dm_flow_nodes').delete().in('id', obsoleteIds);
      }

      // 3. Upsert nodes
      if (nodes.length > 0) {
        const { error } = await supabase.from('dm_flow_nodes').upsert(
          nodes.map(n => ({ id: n.id, flow_id: n.flow_id, type: n.type, data: n.data, position: n.position }))
        );
        if (error) throw error;
      }

      // 4. Replace edges
      await supabase.from('dm_flow_edges').delete().eq('flow_id', flowId);
      if (edges.length > 0) {
        const { error } = await supabase.from('dm_flow_edges').insert(
          edges.map(e => ({
            id: e.id,
            flow_id: e.flow_id,
            source_node_id: e.source_node_id,
            target_node_id: e.target_node_id,
            source_handle: e.source_handle,
          }))
        );
        if (error) throw error;
      }

      // 5. Sync Trigger nodes → chat_rules / comment_rules
      await syncTriggerNodes();

      // 6. Bump timestamp
      await supabase.from('dm_flows').update({ updated_at: new Date().toISOString() }).eq('id', flowId);

      toast.success('Flow saved successfully!');
    } catch (err: any) {
      toast.error('Failed to save flow: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function syncTriggerNodes() {
    if (!flowId) return;
    const triggerNodes = nodes.filter(n => n.type === 'trigger');

    // Fetch authenticated user ID to handle inserts/updates
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // ── Keyword triggers → update dm_flow_id on existing chat_rules ────
    // NOTE: chat_rules has required NOT NULL columns (user_id, page_connection_id, name)
    // that only exist when a rule was created via the Keywords Rules page.
    // So here we ONLY update mutable fields (keywords, match_type, etc.) on existing rows.
    // New trigger nodes created here will be inserted with minimal data and a placeholder name.
    const keywordTriggers = triggerNodes.filter(n => n.data.triggerType === 'keyword');
    const commentTriggers = triggerNodes.filter(n => n.data.triggerType === 'comment');

    // Try updating/inserting chat_rules rows that reference this flow
    for (const tn of keywordTriggers) {
      const { data: existing } = await supabase
        .from('chat_rules')
        .select('id')
        .eq('id', tn.id)
        .maybeSingle();

      const rulePayload = {
        user_id: user.id,
        page_connection_id: tn.data.triggerPageConnectionId || null,
        name: `Trigger: ${(tn.data.triggerKeywords ?? []).join(', ')}`,
        keywords: tn.data.triggerKeywords ?? [],
        // Normalize 'any' (legacy UI value) to 'contains' for the worker
        match_type: (tn.data.triggerMatchType === 'any' || !tn.data.triggerMatchType) ? 'contains' : tn.data.triggerMatchType,
        case_sensitive: tn.data.triggerCaseSensitive ?? false,
        dm_flow_id: flowId,
        action_type: 'flow',
        is_canvas_trigger: true,
        is_active: true,
      };

      if (!tn.data.triggerPageConnectionId) {
        throw new Error(`Please select a Connected Channel / Page for your Trigger block: "${(tn.data.triggerKeywords ?? []).join(', ')}".`);
      }

      if (existing) {
        const { error } = await supabase.from('chat_rules').update(rulePayload).eq('id', tn.id);
        if (error) throw new Error(`Failed to update keyword rule: ${error.message}`);
      } else {
        const { error } = await supabase.from('chat_rules').insert({
          id: tn.id,
          ...rulePayload,
        });
        if (error) throw new Error(`Failed to insert keyword rule: ${error.message}`);
      }
    }

    // Delete orphaned keyword rules that were created by this flow's canvas triggers
    if (keywordTriggers.length > 0) {
      const keepIds = keywordTriggers.map(n => n.id);
      const { error } = await supabase
        .from('chat_rules')
        .delete()
        .eq('dm_flow_id', flowId)
        .eq('is_canvas_trigger', true)
        .not('id', 'in', `(${keepIds.join(',')})`);
      if (error) throw error;
    } else {
      // No keyword triggers on canvas → delete all canvas keyword triggers for this flow
      const { error } = await supabase
        .from('chat_rules')
        .delete()
        .eq('dm_flow_id', flowId)
        .eq('is_canvas_trigger', true);
      if (error) throw error;
    }

    // Update comment_rules that reference this flow
    for (const tn of commentTriggers) {
      const { data: existing } = await supabase
        .from('comment_rules')
        .select('id')
        .eq('id', tn.id)
        .maybeSingle();

      const rulePayload = {
        user_id: user.id,
        page_connection_id: tn.data.triggerPageConnectionId || null,
        trigger_type: tn.data.triggerCommentType ?? 'all',
        keywords: tn.data.triggerKeywords ?? [],
        reply_templates: tn.data.triggerReplyTemplates ?? [],
        dm_flow_id: flowId,
        action_to_take: 'dm',
        post_id: tn.data.triggerApplyToPostType === 'specific' ? tn.data.triggerPostId : null,
        is_canvas_trigger: true,
        is_active: true,
      };

      if (existing) {
        const { error } = await supabase.from('comment_rules').update(rulePayload).eq('id', tn.id);
        if (error) throw new Error(`Failed to update comment rule: ${error.message}`);
      } else {
        const { error } = await supabase.from('comment_rules').insert({
          id: tn.id,
          ...rulePayload,
        });
        if (error) throw new Error(`Failed to insert comment rule: ${error.message}`);
      }
    }

    if (commentTriggers.length > 0) {
      const keepIds = commentTriggers.map(n => n.id);
      await supabase
        .from('comment_rules')
        .delete()
        .eq('dm_flow_id', flowId)
        .eq('is_canvas_trigger', true)
        .not('id', 'in', `(${keepIds.join(',')})`);
    } else {
      // No comment triggers on canvas → delete all canvas comment triggers for this flow
      await supabase
        .from('comment_rules')
        .delete()
        .eq('dm_flow_id', flowId)
        .eq('is_canvas_trigger', true);
    }
  }

  // ─── Import / Export ──────────────────────────────────────────────────
  function handleExportJson() {
    if (!flow) return;
    exportFlow(flow, nodes as any, edges as any);
    toast.success('Flow exported!');
  }

  async function handleImportJson(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (!data.nodes || !Array.isArray(data.nodes)) {
          toast.error('Invalid flow file: missing nodes');
          return;
        }
        const nodeIdMap: Record<string, string> = {};
        const newNodes = data.nodes.map((node: any) => {
          const freshId = crypto.randomUUID();
          nodeIdMap[node.id] = freshId;
          return { id: freshId, flow_id: flowId!, type: node.type, data: node.data ?? {}, position: node.position ?? { x: 100, y: 100 } };
        });
        const newEdges = (data.edges ?? []).map((edge: any) => {
          const src = nodeIdMap[edge.source_node_id];
          const tgt = nodeIdMap[edge.target_node_id];
          if (!src || !tgt) return null;
          return { id: crypto.randomUUID(), flow_id: flowId!, source_node_id: src, target_node_id: tgt, source_handle: edge.source_handle ?? null };
        }).filter(Boolean);
        setNodes(newNodes);
        setEdges(newEdges as FlowEdge[]);
        setSelectedNodeId(null);
        toast.success('Flow loaded. Click Save Flow to persist.');
      } catch (err: any) {
        toast.error('Failed to parse JSON: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  // ─── Loading state ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0d0e10', color: 'var(--text-secondary)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div className="animate-spin" style={{ width: '24px', height: '24px', border: '2px solid var(--accent-primary)', borderTopColor: 'transparent', borderRadius: '50%' }} />
          <span>Loading flow canvas...</span>
        </div>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)', color: '#fff', overflow: 'hidden' }}>

      {/* ── Sub-header toolbar ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-primary)', zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button className="btn-ghost btn-icon" onClick={() => navigate('/flows')} title="Back to Flows">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>{flow?.name ?? 'Loading...'}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '11px', margin: 0 }}>
              Drag blocks · Right-click for options · Click circles to link
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', position: 'relative' }}>
          {/* ── Inline CSS for dropdown items ── */}
          <style>{`
            .fb-dd-item { display:flex;align-items:center;gap:10px;width:100%;padding:8px 12px;background:transparent;border:none;border-radius:var(--radius-md);color:var(--text-primary);font-size:13px;text-align:left;cursor:pointer;transition:background 0.12s; }
            .fb-dd-item:hover { background:rgba(255,255,255,0.08);color:#fff; }
            .fb-dd-group { font-size:9px;font-weight:700;color:var(--text-secondary);padding:6px 8px 2px;letter-spacing:.8px;text-transform:uppercase; }
            .fb-dd-sep { height:1px;background:var(--border-primary);margin:4px 8px; }
          `}</style>

          {/* Backdrop overlays */}
          {addBlockOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 85 }} onClick={() => setAddBlockOpen(false)} />}
          {actionsOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 85 }} onClick={() => setActionsOpen(false)} />}

          {/* Add Block dropdown */}
          <div style={{ position: 'relative', zIndex: 90 }}>
            <button className="btn-primary" onClick={() => setAddBlockOpen(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '13px' }}>
              <Plus size={16} /> Add Block <ChevronDown size={14} />
            </button>
            {addBlockOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: '240px', background: 'rgba(21,23,28,0.97)', backdropFilter: 'blur(12px)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-lg)', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)', padding: '8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div className="fb-dd-group">Triggers</div>
                <button className="fb-dd-item" onClick={() => handleAddNode('trigger')}><Zap size={14} color="#22c55e" /><span>Trigger Block</span></button>
                <div className="fb-dd-sep" />
                <div className="fb-dd-group">Messaging</div>
                <button className="fb-dd-item" onClick={() => handleAddNode('message')}><MessageSquare size={14} color="#4f46e5" /><span>Text Message</span></button>
                <button className="fb-dd-item" onClick={() => handleAddNode('interactive')}><GitPullRequest size={14} color="#d946ef" /><span>Interactive Choices</span></button>
                <button className="fb-dd-item" onClick={() => handleAddNode('capture_input')}><User size={14} color="#06b6d4" /><span>Capture Input</span></button>
                <div className="fb-dd-sep" />
                <div className="fb-dd-group">Logic</div>
                <button className="fb-dd-item" onClick={() => handleAddNode('delay')}><Clock size={14} color="#f59e0b" /><span>Typing Delay</span></button>
                <button className="fb-dd-item" onClick={() => handleAddNode('condition')}><Zap size={14} color="#eab308" /><span>Conditional Rule</span></button>
                <button className="fb-dd-item" onClick={() => handleAddNode('action')}><Settings size={14} color="#10b981" /><span>Action Block</span></button>
                <button className="fb-dd-item" onClick={() => handleAddNode('randomizer')}><Shuffle size={14} color="#ec4899" /><span>A/B Split Test</span></button>
                <button className="fb-dd-item" onClick={() => handleAddNode('goto_flow')}><ArrowRightLeft size={14} color="#3b82f6" /><span>Go-To Flow</span></button>
                <div className="fb-dd-sep" />
                <div className="fb-dd-group">AI Agents</div>
                <button className="fb-dd-item" onClick={() => handleAddNode('ai_agent')}><Sparkles size={14} color="#a855f7" /><span>AI Agent Node</span></button>
                <button className="fb-dd-item" onClick={() => handleAddNode('ai_route')}><Bot size={14} color="#f43f5e" /><span>Resume Chatbot</span></button>
                <div className="fb-dd-sep" />
                <div className="fb-dd-group">Integration</div>
                <button className="fb-dd-item" onClick={() => handleAddNode('lead_webhook')}><Share2 size={14} color="#10b981" /><span>Send Lead (Webhook)</span></button>
              </div>
            )}
          </div>

          {/* Actions dropdown */}
          <div style={{ position: 'relative', zIndex: 90 }}>
            <button className="btn-secondary" onClick={() => setActionsOpen(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', fontSize: '13px' }}>
              <MoreHorizontal size={16} /> Actions <ChevronDown size={14} />
            </button>
            {actionsOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: '160px', background: 'rgba(21,23,28,0.97)', backdropFilter: 'blur(12px)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)', padding: '6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <button className="fb-dd-item" onClick={() => { setActionsOpen(false); document.getElementById('fb-import-json')?.click(); }}><Upload size={14} /><span>Import JSON</span></button>
                <button className="fb-dd-item" onClick={() => { setActionsOpen(false); handleExportJson(); }}><Download size={14} /><span>Export JSON</span></button>
              </div>
            )}
          </div>

          <input id="fb-import-json" type="file" accept=".json" onChange={handleImportJson} style={{ display: 'none' }} />

          <button className="btn-secondary" onClick={handleAutoAlign} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', fontSize: '13px' }}>
            <Sparkles size={14} /> Auto-Align
          </button>

          {flow && (
            <button 
              className={`btn ${flow.feed_to_ai !== false ? 'btn-secondary' : 'btn-ghost'}`} 
              onClick={async () => {
                const nextVal = flow.feed_to_ai !== false ? false : true;
                setFlow({ ...flow, feed_to_ai: nextVal });
                try {
                  const { error } = await supabase
                    .from('dm_flows')
                    .update({ feed_to_ai: nextVal })
                    .eq('id', flow.id);
                  if (error) throw error;
                  toast.success(nextVal ? 'Flow added to AI assistant knowledge base.' : 'Flow hidden from AI assistant knowledge base.');
                } catch (err: any) {
                  toast.error('Failed to update AI knowledge: ' + err.message);
                  setFlow({ ...flow, feed_to_ai: !nextVal });
                }
              }} 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                padding: '8px 12px', 
                fontSize: '13px',
                background: flow.feed_to_ai !== false ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                border: flow.feed_to_ai !== false ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid var(--border-primary)',
                color: flow.feed_to_ai !== false ? '#3b82f6' : 'var(--text-secondary)'
              }}
              title="Let AI Chatbot know about this flow's existence and trigger keywords."
            >
              <BrainCircuit size={14} />
              {flow.feed_to_ai !== false ? 'AI Feed: On' : 'AI Feed: Off'}
            </button>
          )}

          <button className="btn-primary" disabled={saving} onClick={handleSaveFlow} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '13px' }}>
            <Save size={14} />
            {saving ? 'Saving...' : 'Save Flow'}
          </button>
        </div>
      </div>

      {/* ── Main workspace ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>

        {/* ── Canvas Viewport Wrapper (keeps zoom buttons stuck) ───────── */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

          {/* ── Canvas ──────────────────────────────────────────────────── */}
          <div
            ref={canvasRef}
            onMouseMove={handleCanvasMouseMove}
            onMouseDown={handleCanvasMouseDown}
            onMouseUp={() => {
              setDraggingNodeId(null);
              setIsPanning(false);
              setLinkingSource(null);
              setLinkingCursor(null);
            }}
            style={{
              position: 'absolute',
              inset: 0,
              background: '#0d0e10',
              backgroundSize: '24px 24px',
              backgroundImage: 'radial-gradient(circle, #252830 1px, transparent 1px)',
              overflow: 'hidden',
              cursor: draggingNodeId ? 'grabbing' : (isPanning ? 'grabbing' : 'default'),
            }}
            onClick={() => {
              setSelectedNodeId(null);
              setLinkingSource(null);
              setLinkingCursor(null);
              setContextMenu(null);
            }}
          >
            {/* Inner transformed container */}
            <div style={{
              transform: `scale(${zoom}) translate(${panOffset.x}px, ${panOffset.y}px)`,
              transformOrigin: 'top left',
              width: `${CANVAS_W}px`,
              height: `${CANVAS_H}px`,
              position: 'absolute',
              top: 0,
              left: 0
            }}>
              {/* SVG edge lines overlay */}
              <svg style={{ position: 'absolute', top: 0, left: 0, width: `${CANVAS_W}px`, height: `${CANVAS_H}px`, pointerEvents: 'none', zIndex: 10 }}>
                {edges.map(edge => {
                  const start = getNodeHandleCoords(edge.source_node_id, edge.source_handle, 'source');
                  const end   = getNodeHandleCoords(edge.target_node_id, '', 'target');
                  const cpx1  = start.x + Math.abs(end.x - start.x) * 0.4;
                  const cpx2  = end.x   - Math.abs(end.x - start.x) * 0.4;
                  const d     = `M ${start.x} ${start.y} C ${cpx1} ${start.y}, ${cpx2} ${end.y}, ${end.x} ${end.y}`;
                  let strokeColor = 'var(--accent-primary)';
                  if (edge.source_handle === 'true')  strokeColor = 'var(--success)';
                  if (edge.source_handle === 'false') strokeColor = 'var(--error)';
                  return (
                    <g key={edge.id} style={{ pointerEvents: 'auto', cursor: 'pointer' }}>
                      <path d={d} fill="none" stroke="transparent" strokeWidth="10" onClick={e => { e.stopPropagation(); deleteEdge(edge.id); }} />
                      <path d={d} fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" style={{ opacity: 0.85 }} />
                      <circle cx={(start.x + end.x) / 2} cy={(start.y + end.y) / 2} r="9" fill="#151719" stroke={strokeColor} strokeWidth="1.5" style={{ cursor: 'pointer' }} onClick={e => { e.stopPropagation(); deleteEdge(edge.id); }} />
                      <text x={(start.x + end.x) / 2} y={(start.y + end.y) / 2 + 3} fill="var(--error)" fontSize="9px" fontWeight="bold" textAnchor="middle" style={{ pointerEvents: 'none' }}>×</text>
                    </g>
                  );
                })}

                {/* Live connecting line */}
                {linkingSource && linkingCursor && (() => {
                  const start = getNodeHandleCoords(linkingSource.nodeId, linkingSource.handleId, 'source');
                  const d = `M ${start.x} ${start.y} C ${start.x + 80} ${start.y}, ${linkingCursor.x - 80} ${linkingCursor.y}, ${linkingCursor.x} ${linkingCursor.y}`;
                  return <path d={d} fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeDasharray="4 4" />;
                })()}
              </svg>

              {/* Render nodes */}
              {nodes.map(node => (
                <NodeComponent
                  key={node.id}
                  node={node}
                  isSelected={selectedNodeId === node.id}
                  linkingSource={linkingSource}
                  otherFlows={otherFlows}
                  onMouseDown={handleNodeMouseDown}
                  onClick={(e, nodeId) => {
                    e.stopPropagation();
                    if (linkingSource) connectToNode(nodeId);
                    else setSelectedNodeId(nodeId);
                  }}
                  onContextMenu={handleContextMenu}
                  onStartLinking={startLinking}
                  onMouseUpNode={nodeId => {
                    if (linkingSource) connectToNode(nodeId);
                  }}
                  onDelete={handleDeleteNode}
                />
              ))}

              {/* Canvas empty state */}
              {nodes.length === 0 && (
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                  <div style={{ fontSize: '40px', marginBottom: '12px', opacity: 0.15 }}>⬡</div>
                  <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '14px' }}>
                    Click <strong>Add Block</strong> to start building your flow
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Floating Zoom & Pan Controls */}
          <div style={{
            position: 'absolute',
            bottom: '24px',
            right: '24px',
            zIndex: 100,
            display: 'flex',
            gap: '8px',
            background: 'rgba(21, 23, 28, 0.9)',
            backdropFilter: 'blur(8px)',
            border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-lg)',
            padding: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            alignItems: 'center'
          }}>
            <button
              className="btn-ghost"
              style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, border: 'none', background: 'transparent', color: '#fff', fontSize: '16px', cursor: 'pointer' }}
              onClick={(e) => { e.stopPropagation(); handleZoomButton(0.1); }}
              title="Zoom In"
            >
              +
            </button>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '42px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              {Math.round(zoom * 100)}%
            </span>
            <button
              className="btn-ghost"
              style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, border: 'none', background: 'transparent', color: '#fff', fontSize: '16px', cursor: 'pointer' }}
              onClick={(e) => { e.stopPropagation(); handleZoomButton(-0.1); }}
              title="Zoom Out"
            >
              -
            </button>
            <div style={{ width: '1px', background: 'var(--border-primary)', height: '20px', margin: '0 4px' }} />
            <button
              className="btn-ghost"
              style={{ padding: '0 8px', fontSize: '11px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: '#fff', cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                setZoom(1);
                setPanOffset({ x: 0, y: 0 });
              }}
              title="Reset Canvas"
            >
              Reset
            </button>
          </div>
        </div>

        {/* ── Sidebar settings ────────────────────────────────────────── */}
        <div style={{ width: '320px', background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border-primary)', display: 'flex', flexDirection: 'column', overflowY: 'auto', zIndex: 40 }}>
          <SettingsPanel
            selectedNode={selectedNode}
            otherFlows={otherFlows}
            flowId={flowId}
            onUpdateNodeData={updateNodeData}
            onDeleteNode={handleDeleteNode}
          />
        </div>
      </div>

      {/* ── Context menu ─────────────────────────────────────────────── */}
      {contextMenu && (
        <ContextMenu
          menu={contextMenu}
          onDuplicate={handleDuplicateNode}
          onEdit={nodeId => setSelectedNodeId(nodeId)}
          onDelete={handleDeleteNode}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
