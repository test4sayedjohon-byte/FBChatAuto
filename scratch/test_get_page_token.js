const systemUserToken = "EAAPXbs5PW4sBRvWXatqCuan8pttwqoPZC3ksNvlNnIQjafgJfKhmlAZCgdVBylaGS6AH5iQD4CJjLwQLlt67z6YTdHIkE2KuUFX1v0MUQ8veD05ckB7ra4IZA0g6YYHSyJ8AGMXB00YnAnvL5brOhzLV7IIsPefyBvNuaRQ8itivXnzJZA7ArEsYrcZBb0QZDZD";
const pageId = "452281641312964";

async function run() {
  const url = `https://graph.facebook.com/v21.0/${pageId}?fields=access_token,name&access_token=${systemUserToken}`;

  console.log(`Getting page token for page ${pageId}...`);
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log("Response:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
