const fs = require('fs');

const path = 'dashboard/src/pages/flow-builder/index.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  "import { getDefaultDataForType } from './nodeConfig';",
  "import { getDefaultDataForType } from './nodeConfig';\nimport { wouldCreateLoop, validateConnection } from './connectionValidator';"
);

content = content.replace(
  "const [saving, setSaving] = useState(false);",
  "const [saving, setSaving] = useState(false);\n  const [isDirty, setIsDirty] = useState(false);"
);

content = content.replace(
  "useEffect(() => {\n    const handle = () => { if (flowId) loadFlowData(); };\n    window.addEventListener('agent-data-updated', handle);\n    return () => window.removeEventListener('agent-data-updated', handle);\n  }, [flowId]);",
  "useEffect(() => {\n    const handle = () => { if (flowId && !isDirty) loadFlowData(); };\n    window.addEventListener('agent-data-updated', handle);\n    return () => window.removeEventListener('agent-data-updated', handle);\n  }, [flowId, isDirty]);"
);

content = content.replace(
  "function connectToNode(targetNodeId: string) {\n    if (!linkingSource || !flowId) return;\n    if (linkingSource.nodeId === targetNodeId) {\n      toast.error('Cannot link a node to itself.');\n      setLinkingSource(null);\n      setLinkingCursor(null);\n      return;\n    }",
  "function connectToNode(targetNodeId: string) {\n    if (!linkingSource || !flowId) return;\n\n    const sourceNode = nodes.find(n => n.id === linkingSource.nodeId);\n    const targetNode = nodes.find(n => n.id === targetNodeId);\n\n    if (!sourceNode || !targetNode) {\n      setLinkingSource(null);\n      setLinkingCursor(null);\n      return;\n    }\n\n    if (linkingSource.nodeId === targetNodeId) {\n      toast.error('Cannot link a node to itself.');\n      setLinkingSource(null);\n      setLinkingCursor(null);\n      return;\n    }\n\n    if (wouldCreateLoop(edges, linkingSource.nodeId, targetNodeId)) {\n      toast.error('Connection would create an infinite loop.');\n      setLinkingSource(null);\n      setLinkingCursor(null);\n      return;\n    }\n\n    const validation = validateConnection(sourceNode, linkingSource.handleId, targetNode);\n    if (!validation.isValid) {\n      toast.error(validation.error || 'Invalid connection type.');\n      setLinkingSource(null);\n      setLinkingCursor(null);\n      return;\n    }"
);

content = content.replace(
  "setEdges(prev => {\n      const next = [...prev];\n      if (existingIdx > -1) next[existingIdx] = newEdge;\n      else next.push(newEdge);\n      return next;\n    });\n    toast.success('Blocks connected!');",
  "setEdges(prev => {\n      const next = [...prev];\n      if (existingIdx > -1) next[existingIdx] = newEdge;\n      else next.push(newEdge);\n      return next;\n    });\n    setIsDirty(true);\n    toast.success('Blocks connected!');"
);

content = content.replace(
  "function deleteEdge(edgeId: string) {\n    setEdges(prev => prev.filter(e => e.id !== edgeId));\n  }",
  "function deleteEdge(edgeId: string) {\n    setEdges(prev => prev.filter(e => e.id !== edgeId));\n    setIsDirty(true);\n  }"
);

content = content.replace(
  "function handleDeleteNode(nodeId: string) {\n    setNodes(prev => prev.filter(n => n.id !== nodeId));\n    setEdges(prev => prev.filter(e => e.source_node_id !== nodeId && e.target_node_id !== nodeId));\n    if (selectedNodeId === nodeId) setSelectedNodeId(null);\n    toast.success('Block removed.');\n  }",
  "function handleDeleteNode(nodeId: string) {\n    setNodes(prev => prev.filter(n => n.id !== nodeId));\n    setEdges(prev => prev.filter(e => e.source_node_id !== nodeId && e.target_node_id !== nodeId));\n    setIsDirty(true);\n    if (selectedNodeId === nodeId) setSelectedNodeId(null);\n    toast.success('Block removed.');\n  }"
);

content = content.replace(
  "setNodes(prev => [...prev, newNode]);\n    setSelectedNodeId(newNode.id);\n    setAddBlockOpen(false);\n    toast.success(`${type.replace(/_/g, ' ')} block added.`);",
  "setNodes(prev => [...prev, newNode]);\n    setIsDirty(true);\n    setSelectedNodeId(newNode.id);\n    setAddBlockOpen(false);\n    toast.success(`${type.replace(/_/g, ' ')} block added.`);"
);

content = content.replace(
  "setNodes(prev =>\n        prev.map(n => (n.id === draggingNodeId ? { ...n, position: { x: newX, y: newY } } : n))\n      );\n    }",
  "setNodes(prev =>\n        prev.map(n => (n.id === draggingNodeId ? { ...n, position: { x: newX, y: newY } } : n))\n      );\n      setIsDirty(true);\n    }"
);

content = content.replace(
  "setNodes(newNodes);\n    toast.success('Blocks aligned automatically!');",
  "setNodes(newNodes);\n    setIsDirty(true);\n    toast.success('Blocks aligned automatically!');"
);

content = content.replace(
  "setNodes(prev => [...prev, clone]);\n    setSelectedNodeId(clone.id);\n    toast.success('Block duplicated!');",
  "setNodes(prev => [...prev, clone]);\n    setIsDirty(true);\n    setSelectedNodeId(clone.id);\n    toast.success('Block duplicated!');"
);

content = content.replace(
  "function updateNodeData(nodeId: string, patch: Partial<FlowNode['data']>) {\n    setNodes(prev =>\n      prev.map(n => (n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n))\n    );\n  }",
  "function updateNodeData(nodeId: string, patch: Partial<FlowNode['data']>) {\n    setNodes(prev =>\n      prev.map(n => (n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n))\n    );\n    setIsDirty(true);\n  }"
);

content = content.replace(
  "// 2. Fetch obsolete nodes from DB\n      const { data: dbNodes } = await supabase.from('dm_flow_nodes').select('id').eq('flow_id', flowId);\n      const currentIds = new Set(nodes.map(n => n.id));\n      const obsoleteIds = (dbNodes ?? []).map(n => n.id).filter(id => !currentIds.has(id));\n      if (obsoleteIds.length > 0) {\n        await supabase.from('dm_flow_nodes').delete().in('id', obsoleteIds);\n      }\n\n      // 3. Upsert nodes\n      if (nodes.length > 0) {\n        const { error } = await supabase.from('dm_flow_nodes').upsert(\n          nodes.map(n => ({ id: n.id, flow_id: n.flow_id, type: n.type, data: n.data, position: n.position }))\n        );\n        if (error) throw error;\n      }\n\n      // 4. Replace edges\n      await supabase.from('dm_flow_edges').delete().eq('flow_id', flowId);\n      if (edges.length > 0) {\n        const { error } = await supabase.from('dm_flow_edges').insert(\n          edges.map(e => ({\n            id: e.id,\n            flow_id: e.flow_id,\n            source_node_id: e.source_node_id,\n            target_node_id: e.target_node_id,\n            source_handle: e.source_handle,\n          }))\n        );\n        if (error) throw error;\n      }",
  "// 2. Upsert nodes first (safer than delete-and-replace)\n      if (nodes.length > 0) {\n        const { error } = await supabase.from('dm_flow_nodes').upsert(\n          nodes.map(n => ({ id: n.id, flow_id: n.flow_id, type: n.type, data: n.data, position: n.position }))\n        );\n        if (error) throw error;\n      }\n\n      // 3. Delete obsolete nodes\n      const { data: dbNodes } = await supabase.from('dm_flow_nodes').select('id').eq('flow_id', flowId);\n      const currentIds = new Set(nodes.map(n => n.id));\n      const obsoleteIds = (dbNodes ?? []).map(n => n.id).filter(id => !currentIds.has(id));\n      if (obsoleteIds.length > 0) {\n        await supabase.from('dm_flow_nodes').delete().in('id', obsoleteIds);\n      }\n\n      // 4. Sync edges (Upsert then delete obsolete)\n      if (edges.length > 0) {\n        const { error } = await supabase.from('dm_flow_edges').upsert(\n          edges.map(e => ({\n            id: e.id,\n            flow_id: e.flow_id,\n            source_node_id: e.source_node_id,\n            target_node_id: e.target_node_id,\n            source_handle: e.source_handle,\n          }))\n        );\n        if (error) throw error;\n      }\n      \n      const { data: dbEdges } = await supabase.from('dm_flow_edges').select('id').eq('flow_id', flowId);\n      const currentEdgeIds = new Set(edges.map(e => e.id));\n      const obsoleteEdgeIds = (dbEdges ?? []).map(e => e.id).filter(id => !currentEdgeIds.has(id));\n      if (obsoleteEdgeIds.length > 0) {\n        await supabase.from('dm_flow_edges').delete().in('id', obsoleteEdgeIds);\n      }"
);

content = content.replace(
  "// 6. Bump timestamp\n      await supabase.from('dm_flows').update({ updated_at: new Date().toISOString() }).eq('id', flowId);\n\n      toast.success('Flow saved successfully!');",
  "// 6. Bump timestamp\n      await supabase.from('dm_flows').update({ updated_at: new Date().toISOString() }).eq('id', flowId);\n\n      setIsDirty(false);\n      toast.success('Flow saved successfully!');"
);

content = content.replace(
  "{nodes.map(node => (\n                <NodeComponent\n                  key={node.id}\n                  node={node}\n                  isSelected={selectedNodeId === node.id}\n                  linkingSource={linkingSource}\n                  otherFlows={otherFlows}\n                  onMouseDown={handleNodeMouseDown}\n                  onClick={(e, nodeId) => {\n                    e.stopPropagation();\n                    if (linkingSource) connectToNode(nodeId);\n                    else setSelectedNodeId(nodeId);\n                  }}\n                  onContextMenu={handleContextMenu}\n                  onStartLinking={startLinking}\n                  onMouseUpNode={nodeId => {\n                    if (linkingSource) connectToNode(nodeId);\n                  }}\n                  onDelete={handleDeleteNode}\n                />\n              ))}",
  "{nodes.map(node => {\n                let isValidTarget = undefined;\n                if (linkingSource && linkingSource.nodeId !== node.id) {\n                  const sourceNode = nodes.find(n => n.id === linkingSource.nodeId);\n                  if (sourceNode) {\n                    const validation = validateConnection(sourceNode, linkingSource.handleId, node);\n                    const wouldLoop = wouldCreateLoop(edges, linkingSource.nodeId, node.id);\n                    isValidTarget = validation.isValid && !wouldLoop;\n                  }\n                }\n\n                return (\n                  <NodeComponent\n                    key={node.id}\n                    node={node}\n                    isSelected={selectedNodeId === node.id}\n                    linkingSource={linkingSource}\n                    isValidTarget={isValidTarget}\n                    otherFlows={otherFlows}\n                    onMouseDown={handleNodeMouseDown}\n                    onClick={(e, nodeId) => {\n                      e.stopPropagation();\n                      if (linkingSource) connectToNode(nodeId);\n                      else setSelectedNodeId(nodeId);\n                    }}\n                    onContextMenu={handleContextMenu}\n                    onStartLinking={startLinking}\n                    onMouseUpNode={nodeId => {\n                      if (linkingSource) connectToNode(nodeId);\n                    }}\n                    onDelete={handleDeleteNode}\n                  />\n                );\n              })}"
);

fs.writeFileSync(path, content, 'utf8');
