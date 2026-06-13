const fs = require('fs');
const path = 'dashboard/src/pages/flow-builder/NodeComponent.tsx';
let content = fs.readFileSync(path, 'utf8');

// The second background style overrides the first, we need to remove the first background prop inside Incoming handle
content = content.replace(
  "background: '#252830',\n              border: `2.5px solid ${colors.border}`,\n              zIndex: 35,\n              cursor: isTargetCandidate ? (isValidTarget === false ? 'not-allowed' : 'crosshair') : 'default',\n              background: isTargetCandidate && isValidTarget === false ? 'var(--error)' : isTargetCandidate && isValidTarget === true ? 'var(--success)' : '#252830',",
  "border: `2.5px solid ${colors.border}`,\n              zIndex: 35,\n              cursor: isTargetCandidate ? (isValidTarget === false ? 'not-allowed' : 'crosshair') : 'default',\n              background: isTargetCandidate && isValidTarget === false ? 'var(--error)' : isTargetCandidate && isValidTarget === true ? 'var(--success)' : '#252830',"
);

fs.writeFileSync(path, content, 'utf8');
