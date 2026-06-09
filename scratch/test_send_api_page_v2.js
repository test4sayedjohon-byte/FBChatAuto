const accessToken = "EAAPXbs5PW4sBRvWXatqCuan8pttwqoPZC3ksNvlNnIQjafgJfKhmlAZCgdVBylaGS6AH5iQD4CJjLwQLlt67z6YTdHIkE2KuUFX1v0MUQ8veD05ckB7ra4IZA0g6YYHSyJ8AGMXB00YnAnvL5brOhzLV7IIsPefyBvNuaRQ8itivXnzJZA7ArEsYrcZBb0QZDZD";
const pageId = "452281641312964";
const recipientId = "26401806566164422"; // From session 14a185f7-92c4-4feb-b87a-d37192d9343f

async function run() {
  const url = `https://graph.facebook.com/v21.0/${pageId}/messages`;
  const payload = {
    recipient: { id: recipientId },
    message: { text: "Hello! This is a test message from System User Token using /{page_id}/messages endpoint." },
    messaging_type: 'RESPONSE',
  };

  console.log(`Sending test reply to /${pageId}/messages...`);
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
