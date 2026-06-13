const fs = require('fs');
const path = 'dashboard/src/pages/flow-builder/connectionValidator.ts';
let content = fs.readFileSync(path, 'utf8');

// The file has a literal backslash escaping the backticks
content = content.replace(
  "error: \\`Type mismatch: Cannot connect '\\${sourceOutputType}' output to a block expecting [\\${acceptedInputs.join(', ')}].\\`",
  "error: `Type mismatch: Cannot connect '${sourceOutputType}' output to a block expecting [${acceptedInputs.join(', ')}].`"
);

fs.writeFileSync(path, content, 'utf8');
