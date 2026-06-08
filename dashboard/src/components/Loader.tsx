import * as React from "react";

interface LoaderProps {
  size?: number; 
  text?: string;
}

export const Loader: React.FC<LoaderProps> = ({ size = 180, text = "Generating" }) => {
  const letters = text.split("");

  return (
    <div className="loader-overlay">
      <div
        className="loader-wrapper"
        style={{ width: size, height: size }}
      >
        {letters.map((letter, index) => (
          <span
            key={index}
            className="loader-letter"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            {letter === " " ? "\u00A0" : letter}
          </span>
        ))}

        <div className="loader-circle"></div>
      </div>

      <style>{`
        .loader-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(to bottom, #1a3379, #0f172a, #000000);
          transition: all 0.3s ease;
        }

        .loader-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Inter', sans-serif;
          user-select: none;
          gap: 2px;
        }

        .loader-letter {
          display: inline-block;
          color: #ffffff;
          opacity: 0.4;
          font-size: 1.5rem;
          font-weight: 700;
          animation: loaderLetter 3s infinite;
        }

        .loader-circle {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          border-radius: 50%;
          animation: loaderCircle 5s linear infinite;
        }

        @keyframes loaderCircle {
          0% {
            transform: rotate(90deg);
            box-shadow:
              0 6px 12px 0 #38bdf8 inset,
              0 12px 18px 0 #005dff inset,
              0 36px 36px 0 #1e40af inset,
              0 0 3px 1.2px rgba(56, 189, 248, 0.3),
              0 0 6px 1.8px rgba(0, 93, 255, 0.2);
          }
          50% {
            transform: rotate(270deg);
            box-shadow:
              0 6px 12px 0 #60a5fa inset,
              0 12px 6px 0 #0284c7 inset,
              0 24px 36px 0 #005dff inset,
              0 0 3px 1.2px rgba(56, 189, 248, 0.3),
              0 0 6px 1.8px rgba(0, 93, 255, 0.2);
          }
          100% {
            transform: rotate(450deg);
            box-shadow:
              0 6px 12px 0 #4dc8fd inset,
              0 12px 18px 0 #005dff inset,
              0 36px 36px 0 #1e40af inset,
              0 0 3px 1.2px rgba(56, 189, 248, 0.3),
              0 0 6px 1.8px rgba(0, 93, 255, 0.2);
          }
        }

        @keyframes loaderLetter {
          0%,
          100% {
            opacity: 0.4;
            transform: translateY(0);
          }
          20% {
            opacity: 1;
            transform: scale(1.15);
          }
          40% {
            opacity: 0.7;
            transform: translateY(0);
          }
        }

        @media (prefers-color-scheme: dark) {
          .loader-overlay {
            background: linear-gradient(to bottom, #f3f4f6, #e5e7eb, #d1d5db);
          }
          .loader-letter {
            color: #1f2937;
          }
          .loader-circle {
            animation: loaderCircleDark 5s linear infinite;
          }
        }

        @keyframes loaderCircleDark {
          0% {
            transform: rotate(90deg);
            box-shadow:
              0 6px 12px 0 #4b5563 inset,
              0 12px 18px 0 #6b7280 inset,
              0 36px 36px 0 #9ca3af inset,
              0 0 3px 1.2px rgba(107, 114, 128, 0.3),
              0 0 6px 1.8px rgba(156, 163, 175, 0.2);
          }
          50% {
            transform: rotate(270deg);
            box-shadow:
              0 6px 12px 0 #4b5563 inset,
              0 12px 18px 0 #6b7280 inset,
              0 36px 36px 0 #9ca3af inset,
              0 0 3px 1.2px rgba(107, 114, 128, 0.3),
              0 0 6px 1.8px rgba(156, 163, 175, 0.2);
          }
          100% {
            transform: rotate(450deg);
            box-shadow:
              0 6px 12px 0 #4b5563 inset,
              0 12px 18px 0 #6b7280 inset,
              0 36px 36px 0 #9ca3af inset,
              0 0 3px 1.2px rgba(107, 114, 128, 0.3),
              0 0 6px 1.8px rgba(156, 163, 175, 0.2);
          }
        }
      `}</style>
    </div>
  );
};

export const Component = Loader;
export default Loader;
