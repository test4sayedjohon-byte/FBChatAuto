const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://bbfqyskkwustlrbxqajz.supabase.co', process.env.SUPABASE_SERVICE_KEY || 'YOUR_SUPABASE_SERVICE_ROLE_KEY');

const query = 'ভাই এখান থেকে ইনকাম কেমন হতে পারে?';
const docText = `* **Financial Expectations (Earnings Disclaimer):** The hardware and software tools do not guarantee income. Similar to how a hammer doesn't guarantee a house, these tools provide the capability, but income depends entirely on the user's skill and ability to monetize.`;

function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0.0;
  let normA = 0.0;
  let normB = 0.0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function getEmbedding(text, apiKey) {
  const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'openai/text-embedding-3-small',
      input: text
    })
  });
  const resJson = await response.json();
  return resJson.data[0].embedding;
}

async function run() {
  const apiKey = process.env.OPENROUTER_API_KEY || 'YOUR_OPENROUTER_API_KEY';
  
  console.log("Embedding query...");
  const queryVec = await getEmbedding(query, apiKey);
  
  console.log("Embedding document text...");
  const docVec = await getEmbedding(docText, apiKey);
  
  const similarity = cosineSimilarity(queryVec, docVec);
  console.log(`Fresh text-embedding-3-small Cosine Similarity: ${similarity.toFixed(4)}`);
}

run();
