const fs = require('fs');

const path = 'dashboard/src/pages/flow-builder/NodeComponent.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  "interface NodeComponentProps {\n  node: FlowNode;\n  isSelected: boolean;\n  linkingSource: LinkingSource | null;\n  otherFlows: Array<{ id: string; name: string }>;\n  onMouseDown: (e: React.MouseEvent, nodeId: string) => void;",
  "interface NodeComponentProps {\n  node: FlowNode;\n  isSelected: boolean;\n  linkingSource: LinkingSource | null;\n  isValidTarget?: boolean;\n  otherFlows: Array<{ id: string; name: string }>;\n  onMouseDown: (e: React.MouseEvent, nodeId: string) => void;"
);

content = content.replace(
  "export default function NodeComponent({\n  node,\n  isSelected,\n  linkingSource,\n  otherFlows,\n  onMouseDown,",
  "export default function NodeComponent({\n  node,\n  isSelected,\n  linkingSource,\n  isValidTarget,\n  otherFlows,\n  onMouseDown,"
);

content = content.replace(
  "border: isSelected\n          ? `2px solid ${colors.border}`\n          : isTargetCandidate\n          ? '2px dashed var(--accent-primary)'\n          : '1px solid var(--border-primary)',",
  "border: isSelected\n          ? `2px solid ${colors.border}`\n          : isTargetCandidate\n          ? (isValidTarget === true ? '2px dashed var(--success)' : isValidTarget === false ? '2px dashed var(--error)' : '2px dashed var(--accent-primary)')\n          : '1px solid var(--border-primary)',"
);

content = content.replace(
  "cursor: isTargetCandidate ? 'pointer' : 'default',",
  "cursor: isTargetCandidate ? (isValidTarget === false ? 'not-allowed' : 'crosshair') : 'default',\n              background: isTargetCandidate && isValidTarget === false ? 'var(--error)' : isTargetCandidate && isValidTarget === true ? 'var(--success)' : '#252830',"
);

fs.writeFileSync(path, content, 'utf8');
