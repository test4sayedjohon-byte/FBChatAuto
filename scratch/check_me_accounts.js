const token = "EAAPXbs5PW4sBRvWXatqCuan8pttwqoPZC3ksNvlNnIQjafgJfKhmlAZCgdVBylaGS6AH5iQD4CJjLwQLlt67z6YTdHIkE2KuUFX1v0MUQ8veD05ckB7ra4IZA0g6YYHSyJ8AGMXB00YnAnvL5brOhzLV7IIsPefyBvNuaRQ8itivXnzJZA7ArEsYrcZBb0QZDZD";

async function run() {
  const url = `https://graph.facebook.com/v21.0/me/accounts?access_token=${token}`;
  console.log("Checking /me/accounts...");
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log("Accounts Response:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
