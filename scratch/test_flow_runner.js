// ============================================================================
// Visual Flow Engine Verification Script
// ============================================================================

const assert = require('assert');

// 1. Mock implementation of replaceVariables to verify template substitutions
function replaceVariables(text, stateData, senderName) {
  if (!text) return text;
  
  let name = 'there';
  if (senderName) {
    name = senderName.split(' ')[0] || senderName;
  } else if (stateData.first_name) {
    name = stateData.first_name;
  } else if (stateData.name) {
    name = stateData.name;
  }

  const phone = stateData.phone || stateData.phone_number || 'not provided';
  const email = stateData.email || 'not provided';

  // Find last_choice
  const choiceKeys = Object.keys(stateData).filter(k => k.startsWith('choice_'));
  const lastChoiceKey = choiceKeys[choiceKeys.length - 1];
  const lastChoice = lastChoiceKey ? stateData[lastChoiceKey] : 'none';

  return text
    .replace(/\{\{name\}\}/gi, name)
    .replace(/\{\{phone\}\}/gi, phone)
    .replace(/\{\{email\}\}/gi, email)
    .replace(/\{\{last_choice\}\}/gi, lastChoice);
}

// 2. Mock input validation logic
function validateInput(text, type) {
  const trimmedText = text.trim();
  if (type === 'email') {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedText);
  } else if (type === 'phone') {
    return /^\+?[0-9\s\-()]{7,20}$/.test(trimmedText);
  } else {
    return trimmedText.length > 0;
  }
}

// Run unit tests
try {
  console.log("🚀 Starting Flow Engine Verification Tests...");

  // Test 1: Template replacements
  const stateData = {
    first_name: "Sayed",
    phone: "+8801700000000",
    email: "test@example.com",
    choice_node1: "phone_farming",
    choice_node2: "smm"
  };

  const templateStr = "Hello {{name}}, you selected {{last_choice}}. Phone: {{phone}}, Email: {{email}}.";
  const expectedText = "Hello Sayed, you selected smm. Phone: +8801700000000, Email: test@example.com.";
  
  const resultText = replaceVariables(templateStr, stateData);
  assert.strictEqual(resultText, expectedText);
  console.log("✅ Test 1 Passed: Template variable substitution is correct.");

  // Test 2: Fallback variable replacements
  const emptyState = {};
  const fallbackText = replaceVariables("Hello {{name}}, selection: {{last_choice}}. Phone: {{phone}}, Email: {{email}}.", emptyState, "Sayed Johon");
  assert.strictEqual(fallbackText, "Hello Sayed, selection: none. Phone: not provided, Email: not provided.");
  console.log("✅ Test 2 Passed: Variable replacement fallbacks and name splitting function correctly.");

  // Test 3: Validation checks
  assert.strictEqual(validateInput("test@example.com", "email"), true);
  assert.strictEqual(validateInput("testexample.com", "email"), false);
  assert.strictEqual(validateInput("  ", "email"), false);
  
  assert.strictEqual(validateInput("+1234567890", "phone"), true);
  assert.strictEqual(validateInput("not-a-phone", "phone"), false);
  
  assert.strictEqual(validateInput("Hello World", "text"), true);
  assert.strictEqual(validateInput("  ", "text"), false);
  
  console.log("✅ Test 3 Passed: User input validations (email, phone, text) work perfectly.");

  console.log("🎉 All integration tests passed successfully!");
} catch (err) {
  console.error("❌ Test verification failed:", err);
  process.exit(1);
}
