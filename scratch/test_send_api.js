const accessToken = "EAAPXbs5PW4sBRvWXatqCuan8pttwqoPZC3ksNvlNnIQjafgJfKhmlAZCgdVBylaGS6AH5iQD4CJjLwQLlt67z6YTdHIkE2KuUFX1v0MUQ8veD05ckB7ra4IZA0g6YYHSyJ8AGMXB00YnAnvL5brOhzLV7IIsPefyBvNuaRQ8itivXnzJZA7ArEsYrcZBb0QZDZD";
const recipientId = "26969391986066091";

async function run() {
  const url = 'https://graph.facebook.com/v25.0/me/messages';
  const payload = {
    recipient: { id: recipientId },
    message: { text: "Hello! This is a test message to check /me/messages with v25.0." },
    messaging_type: 'RESPONSE',
  };

  console.log("Sending test reply with new token to /me/messages...");
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(payload)
    });

    const text = await res.text();
    console.log("Response Status:", res.status);
    console.log("Response Body:", text);
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
