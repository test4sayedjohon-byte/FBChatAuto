// ─── NodeComponent ─────────────────────────────────────────────────────────
// Renders a single flow node card on the canvas. Handles:
//   - Visual preview of node data
//   - Connection handle circles (source / target)
//   - Left/right click forwarding to parent handlers
//   - Right-click → context menu (via onContextMenu prop)
// ───────────────────────────────────────────────────────────────────────────
import {
  Clock,
  Bot,
  Settings,
  FileImage,
  Zap,
  X,
} from 'lucide-react';
import type { FlowNode, LinkingSource } from './types';
import { NODE_COLORS } from './nodeConfig';

interface NodeComponentProps {
  node: FlowNode;
  isSelected: boolean;
  linkingSource: LinkingSource | null;
  isValidTarget?: boolean;
  otherFlows: Array<{ id: string; name: string }>;
  onMouseDown: (e: React.MouseEvent, nodeId: string) => void;
  onClick: (e: React.MouseEvent, nodeId: string) => void;
  onContextMenu: (e: React.MouseEvent, nodeId: string) => void;
  onStartLinking: (nodeId: string, handleId: string, e: React.MouseEvent) => void;
  onMouseUpNode: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
}

export default function NodeComponent({
  node,
  isSelected,
  linkingSource,
  isValidTarget,
  otherFlows,
  onMouseDown,
  onClick,
  onContextMenu,
  onStartLinking,
  onMouseUpNode,
  onDelete,
}: NodeComponentProps) {
  const colors = NODE_COLORS[node.type] ?? NODE_COLORS.message;
  const isTargetCandidate = linkingSource && linkingSource.nodeId !== node.id;

  // ─── Handle dot helpers ──────────────────────────────────────────────────
  function OutHandle({
    handleId,
    topOffset = 33,
    rightOffset = -7,
    color,
    title,
  }: {
    handleId: string;
    topOffset?: number;
    rightOffset?: number;
    color?: string;
    title?: string;
  }) {
    return (
      <div
        onMouseDown={e => {
          e.stopPropagation();
          e.preventDefault();
          onStartLinking(node.id, handleId, e);
        }}
        onMouseUp={e => {
          e.stopPropagation();
        }}
        onClick={e => {
          e.stopPropagation();
        }}
        title={title ?? `Link: ${handleId}`}
        style={{
          position: 'absolute',
          right: `${rightOffset}px`,
          top: `${topOffset}px`,
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          background: color ?? colors.border,
          border: '2px solid #15171c',
          zIndex: 35,
          cursor: 'crosshair',
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: `${node.position.x}px`,
        top: `${node.position.y}px`,
        width: '240px',
        background: '#15171c',
        border: isSelected
          ? `2px solid ${colors.border}`
          : isTargetCandidate
          ? (isValidTarget === true ? '2px dashed var(--success)' : isValidTarget === false ? '2px dashed var(--error)' : '2px dashed var(--accent-primary)')
          : '1px solid var(--border-primary)',
        borderRadius: 'var(--radius-md)',
        boxShadow: isSelected
          ? `0 0 14px ${colors.border}55`
          : 'var(--shadow-md)',
        zIndex: isSelected ? 30 : 20,
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
        userSelect: 'none',
      }}
      onClick={e => onClick(e, node.id)}
      onMouseUp={e => {
        if (linkingSource) {
          e.stopPropagation();
          onMouseUpNode(node.id);
        }
      }}
      onContextMenu={e => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu(e, node.id);
      }}
    >
      {/* ── Header drag handle ─────────────────────────────────────────── */}
      <div
        onMouseDown={e => onMouseDown(e, node.id)}
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--border-primary)',
          background: colors.bg,
          borderTopLeftRadius: 'var(--radius-sm)',
          borderTopRightRadius: 'var(--radius-sm)',
          cursor: 'grab',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: colors.border,
          }}
        >
          {colors.label}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.3px' }}>
            right-click
          </span>
          {/* Quick delete X button */}
          <button
            onClick={e => { e.stopPropagation(); onDelete(node.id); }}
            onMouseDown={e => e.stopPropagation()} /* prevent drag on click */
            title="Delete block"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.25)',
              padding: '1px',
              display: 'flex',
              alignItems: 'center',
              borderRadius: '3px',
              transition: 'color 0.12s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.25)')}
          >
            <X size={11} />
          </button>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────── */}
      <div style={{ padding: '12px', fontSize: '12px', color: 'var(--text-primary)', position: 'relative' }}>

        {/* Incoming handle (left side) */}
        {node.type !== 'trigger' && (
          <div
            title="Incoming connection"
            style={{
              position: 'absolute',
              left: '-7px',
              top: '33px',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              border: `2.5px solid ${colors.border}`,
              zIndex: 35,
              cursor: isTargetCandidate ? (isValidTarget === false ? 'not-allowed' : 'crosshair') : 'default',
              background: isTargetCandidate && isValidTarget === false ? 'var(--error)' : isTargetCandidate && isValidTarget === true ? 'var(--success)' : '#252830',
            }}
          />
        )}

        {/* ──── TRIGGER node ──────────────────────────────────────────── */}
        {node.type === 'trigger' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Zap size={13} color={colors.border} />
              <span style={{ fontWeight: 'bold', fontSize: '11px', color: colors.border }}>
                {node.data.triggerType === 'comment' ? 'Comment Trigger' : 'Keyword Trigger'}
              </span>
            </div>
            {(node.data.triggerKeywords ?? []).length > 0 ? (
              <div
                style={{
                  fontSize: '10px',
                  color: 'var(--text-secondary)',
                  fontFamily: 'monospace',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {node.data.triggerKeywords!.slice(0, 3).join(', ')}
                {node.data.triggerKeywords!.length > 3 && ' ...'}
              </div>
            ) : (
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>
                No keywords set
              </div>
            )}
            <OutHandle handleId="default" topOffset={33} title="Flow starts here" />
          </div>
        )}

        {/* ──── MESSAGE node ──────────────────────────────────────────── */}
        {node.type === 'message' && (
          <div>
            <div
              style={{
                color: 'var(--text-secondary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {node.data.text || <span style={{ fontStyle: 'italic', opacity: 0.5 }}>Empty Message</span>}
            </div>
            {node.data.mediaUrl && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: '#252830',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  marginTop: '6px',
                  fontSize: '9px',
                  color: 'var(--accent-primary)',
                }}
              >
                <FileImage size={10} /> Media Attached
              </div>
            )}
            <OutHandle handleId="default" topOffset={33} title="Next step" />
          </div>
        )}

        {/* ──── INTERACTIVE node ──────────────────────────────────────── */}
        {node.type === 'interactive' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              {node.data.text || 'Choose Options:'}
            </div>
            {(node.data.buttons ?? []).map((btn, idx) => {
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
                    textAlign: 'center',
                  }}
                >
                  {btn.title}
                  {btn.type !== 'web_url' && btn.type !== 'phone_number' && (
                    <OutHandle
                      handleId={handleName}
                      topOffset={8}
                      rightOffset={-19}
                      title={`Button: "${btn.title}"`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ──── DELAY node ──────────────────────────────────────────────── */}
        {node.type === 'delay' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={14} color="#f59e0b" />
            <span>Wait {node.data.delaySeconds ?? 3} seconds</span>
            <OutHandle handleId="default" topOffset={33} />
          </div>
        )}

        {/* ──── CONDITION node ──────────────────────────────────────────── */}
        {node.type === 'condition' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}>
            <div
              style={{
                fontSize: '11px',
                background: '#252830',
                padding: '4px',
                borderRadius: '4px',
                textAlign: 'center',
                fontFamily: 'monospace',
              }}
            >
              {node.data.conditionKey ?? 'attribute'}{' '}
              {node.data.conditionOperator === 'contains'
                ? 'contains'
                : node.data.conditionOperator === 'exists'
                ? 'exists'
                : '='}{' '}
              {node.data.conditionOperator !== 'exists' ? `"${node.data.conditionValue}"` : ''}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
              <div
                style={{
                  position: 'relative',
                  fontSize: '10px',
                  color: 'var(--success)',
                  fontWeight: 'bold',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                TRUE
                <OutHandle handleId="true" topOffset={8} rightOffset={-19} color="var(--success)" title="If matches" />
              </div>
              <div
                style={{
                  position: 'relative',
                  fontSize: '10px',
                  color: 'var(--error)',
                  fontWeight: 'bold',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                FALSE
                <OutHandle handleId="false" topOffset={8} rightOffset={-19} color="var(--error)" title="If fails" />
              </div>
            </div>
          </div>
        )}

        {/* ──── ACTION node ──────────────────────────────────────────────── */}
        {node.type === 'action' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div
              style={{
                textTransform: 'capitalize',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Settings size={12} color="#10b981" />
              {(node.data.actionType ?? 'action').replace(/_/g, ' ')}
            </div>
            {node.data.actionType === 'set_attribute' && node.data.actionParams && (
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                {node.data.actionParams.key} = {node.data.actionParams.value}
              </div>
            )}
            <OutHandle handleId="default" topOffset={33} />
          </div>
        )}

        {/* ──── AI ROUTE node ──────────────────────────────────────────── */}
        {node.type === 'ai_route' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.8 }}>
            <Bot size={14} color="#f43f5e" />
            <span>Resume Chatbot Control</span>
          </div>
        )}

        {/* ──── CAPTURE INPUT node ─────────────────────────────────────── */}
        {node.type === 'capture_input' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '11px', color: 'var(--text-secondary)' }}>
              Save to:{' '}
              <span style={{ fontFamily: 'monospace', color: 'var(--accent-primary)' }}>
                {node.data.captureKey ?? 'input'}
              </span>
            </div>
            <div
              style={{
                fontSize: '10px',
                opacity: 0.8,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              Prompt: &ldquo;{node.data.text ?? 'Type value...'}&rdquo;
            </div>
            <OutHandle handleId="default" topOffset={33} />
          </div>
        )}

        {/* ──── LEAD WEBHOOK node ──────────────────────────────────────── */}
        {node.type === 'lead_webhook' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '11px', color: 'var(--text-secondary)' }}>
              Send Lead info
            </div>
            <div
              style={{
                fontSize: '9px',
                fontFamily: 'monospace',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                opacity: 0.7,
              }}
            >
              {node.data.webhookUrl ?? 'No Webhook URL'}
            </div>
            <OutHandle handleId="default" topOffset={33} />
          </div>
        )}

        {/* ──── RANDOMIZER node ────────────────────────────────────────── */}
        {node.type === 'randomizer' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative' }}>
            <div style={{ fontWeight: 'bold', fontSize: '11px', color: 'var(--text-secondary)' }}>
              Split Test Leads
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
              <div
                style={{
                  position: 'relative',
                  fontSize: '10px',
                  color: 'var(--accent-primary)',
                  fontWeight: 'bold',
                  height: '22px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                PATH A (50%)
                <OutHandle handleId="path_a" topOffset={8} rightOffset={-19} title="Path A" />
              </div>
              <div
                style={{
                  position: 'relative',
                  fontSize: '10px',
                  color: 'var(--accent-primary)',
                  fontWeight: 'bold',
                  height: '22px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                PATH B (50%)
                <OutHandle handleId="path_b" topOffset={8} rightOffset={-19} title="Path B" />
              </div>
            </div>
          </div>
        )}

        {/* ──── GOTO FLOW node ─────────────────────────────────────────── */}
        {node.type === 'goto_flow' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '11px', color: 'var(--text-secondary)' }}>
              Jump to Flow
            </div>
            <div
              style={{
                fontSize: '10px',
                opacity: 0.8,
                color: 'var(--accent-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {otherFlows.find(f => f.id === node.data.targetFlowId)?.name ?? 'Select Flow...'}
            </div>
          </div>
        )}

        {/* ──── AI AGENT node ──────────────────────────────────────────── */}
        {node.type === 'ai_agent' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '11px', color: 'var(--text-secondary)' }}>
              Model:{' '}
              <span style={{ fontFamily: 'monospace', color: 'var(--accent-primary)' }}>
                {node.data.aiModel ?? 'Default'}
              </span>
            </div>
            <div
              style={{
                fontSize: '10px',
                opacity: 0.8,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              &ldquo;{node.data.promptInstructions ?? 'You are a helpful assistant...'}&rdquo;
            </div>
            <OutHandle handleId="default" topOffset={33} />
          </div>
        )}

      </div>
    </div>
  );
}
