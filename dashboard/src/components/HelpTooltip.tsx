import { useState } from 'react';
import { Info } from 'lucide-react';

export const HELP_TEXTS = {
  quickAnswers: {
    title: 'Quick Answers (formerly Knowledge Base)',
    description: 'Quick Answers are short, strict rules and facts about your business (e.g., "Business Hours: 9-5", "Contact Email: support@example.com").',
    details: 'Unlike long-form documents, the AI looks up these facts instantly to follow strict behavioral rules or provide quick answers without scanning massive paragraphs. You can manually add them or use the JSON Import tool to auto-generate 50+ facts at once using an external AI like ChatGPT.'
  },
  knowledgeBase: {
    title: 'Knowledge Base (formerly Documents)',
    description: 'The Knowledge Base stores your long-form text documents, PDFs, return policies, and massive FAQs.',
    details: 'When you upload text here, the system chops it into tiny pieces and converts it into "Vector Embeddings". Using Retrieval-Augmented Generation (RAG), the AI searches through these documents to magically pull the exact right paragraph when a customer asks a complex question.'
  },
  dataSources: {
    title: 'Data Sources (formerly Knowledge Folders)',
    description: 'Data Sources allow you to group your Knowledge Base documents together.',
    details: 'Since you might connect multiple completely different Facebook pages (e.g., a Clothing Brand and a Real Estate agency) to this dashboard, you need to group documents into Data Sources. You can then assign a specific Data Source to a specific Meta Channel so the AI never mixes up the return policies of the clothing brand with the real estate brand.'
  },
  knowledgeBaseUnified: {
    title: 'Folders & Documents',
    description: 'Data Sources act as folders that you assign to specific Facebook Pages. Documents are the actual text the AI reads.',
    details: 'By keeping documents in specific folders, you ensure the AI only uses relevant knowledge for each connected Facebook Page. Click on a folder to view and add documents to it.'
  }
};

interface HelpTooltipProps {
  id: keyof typeof HELP_TEXTS;
}

export default function HelpTooltip({ id }: HelpTooltipProps) {
  const [show, setShow] = useState(false);
  const content = HELP_TEXTS[id];

  return (
    <div 
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: '8px', zIndex: 50 }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onClick={() => setShow(!show)}
    >
      <Info size={16} style={{ color: 'var(--text-secondary)', cursor: 'pointer' }} />
      
      {show && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginTop: '8px',
          width: '320px',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-primary)',
          borderRadius: '8px',
          padding: '16px',
          boxShadow: 'var(--shadow-lg)',
          color: 'var(--text-primary)',
          fontSize: '0.85rem',
          lineHeight: '1.5',
          textAlign: 'left'
        }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '0.95rem', color: 'var(--accent-primary)' }}>{content.title}</h4>
          <p style={{ margin: '0 0 8px 0', fontWeight: 500 }}>{content.description}</p>
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{content.details}</p>
        </div>
      )}
    </div>
  );
}
