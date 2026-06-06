import * as React from "react";
import { useState, useId, useEffect } from "react";
import { Slot } from "@radix-ui/react-slot";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

// Helper for minimal class merging without tailwind-merge
function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}

export interface TypewriterProps {
  text: string | string[];
  speed?: number;
  cursor?: string;
  loop?: boolean;
  deleteSpeed?: number;
  delay?: number;
  className?: string;
}

export function Typewriter({
  text,
  speed = 100,
  cursor = "|",
  loop = false,
  deleteSpeed = 50,
  delay = 1500,
  className,
}: TypewriterProps) {
  const [displayText, setDisplayText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [textArrayIndex, setTextArrayIndex] = useState(0);

  const textArray = Array.isArray(text) ? text : [text];
  const currentText = textArray[textArrayIndex] || "";

  useEffect(() => {
    if (!currentText) return;

    const timeout = setTimeout(
      () => {
        if (!isDeleting) {
          if (currentIndex < currentText.length) {
            setDisplayText((prev) => prev + currentText[currentIndex]);
            setCurrentIndex((prev) => prev + 1);
          } else if (loop) {
            setTimeout(() => setIsDeleting(true), delay);
          }
        } else {
          if (displayText.length > 0) {
            setDisplayText((prev) => prev.slice(0, -1));
          } else {
            setIsDeleting(false);
            setCurrentIndex(0);
            setTextArrayIndex((prev) => (prev + 1) % textArray.length);
          }
        }
      },
      isDeleting ? deleteSpeed : speed,
    );

    return () => clearTimeout(timeout);
  }, [
    currentIndex,
    isDeleting,
    currentText,
    loop,
    speed,
    deleteSpeed,
    delay,
    displayText,
    text,
  ]);

  return (
    <span className={className}>
      {displayText}
      <span style={{ animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" }}>{cursor}</span>
    </span>
  );
}

const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label ref={ref} className={cn("form-label", className)} {...props} />
  )
);
Label.displayName = "Label";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "danger";
}
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const variantClass = variant === "primary" ? "btn-primary" : variant === "secondary" ? "btn-secondary" : variant === "danger" ? "btn-danger" : "btn-ghost";
    return <Comp className={cn("btn", variantClass, className)} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn("form-input", className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
}
const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, label, ...props }, ref) => {
    const id = useId();
    const [showPassword, setShowPassword] = useState(false);
    const togglePasswordVisibility = () => setShowPassword((prev) => !prev);
    return (
      <div className="form-group">
        {label && <Label htmlFor={id}>{label}</Label>}
        <div style={{ position: "relative" }}>
          <Input id={id} type={showPassword ? "text" : "password"} className={cn(className)} style={{ paddingRight: "40px" }} ref={ref} {...props} />
          <button type="button" onClick={togglePasswordVisibility} style={{ position: "absolute", right: "0", top: "0", bottom: "0", display: "flex", alignItems: "center", justifyContent: "center", width: "40px", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }} aria-label={showPassword ? "Hide password" : "Show password"}>
            {showPassword ? (<EyeOff size={16} aria-hidden="true" />) : (<Eye size={16} aria-hidden="true" />)}
          </button>
        </div>
      </div>
    );
  }
);
PasswordInput.displayName = "PasswordInput";

function SignInForm({ onForgotPassword }: { onForgotPassword: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSignIn = async (event: React.FormEvent<HTMLFormElement>) => { 
    event.preventDefault(); 
    setErrorMsg('');
    setLoading(true);
    try {
      const { error } = await signIn(email, password);
      if (error) {
        setErrorMsg(error.message);
      } else {
        navigate('/');
      }
    } catch {
      setErrorMsg('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSignIn} autoComplete="on">
      <div style={{ textAlign: "center", marginBottom: "32px" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: "700", marginBottom: "8px" }}>Sign in to your account</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Enter your email below to sign in</p>
      </div>
      <div>
        <div className="form-group">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="m@example.com" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <PasswordInput name="password" label="Password" required autoComplete="current-password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
        
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "-8px", marginBottom: "16px" }}>
          <button 
            type="button" 
            onClick={onForgotPassword} 
            style={{ background: "none", border: "none", color: "var(--accent-primary)", cursor: "pointer", fontSize: "0.85rem", padding: 0 }}
          >
            Forgot password?
          </button>
        </div>
        
        {errorMsg && <div className="form-error" style={{ marginBottom: "16px", textAlign: "center" }}>{errorMsg}</div>}
        
        <Button type="submit" variant="secondary" style={{ width: "100%", marginTop: "8px" }} disabled={loading}>
          {loading && <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />}
          Sign In
        </Button>
      </div>
    </form>
  );
}

function SignUpForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handleSignUp = async (event: React.FormEvent<HTMLFormElement>) => { 
    event.preventDefault(); 
    setErrorMsg('');
    setLoading(true);
    try {
      const { error } = await signUp(email, password, name);
      if (error) {
        setErrorMsg(error.message);
      } else {
        const { error: signInError } = await signIn(email, password);
        if (signInError) {
          setErrorMsg(signInError.message);
        } else {
          navigate('/');
        }
      }
    } catch {
      setErrorMsg('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSignUp} autoComplete="on">
      <div style={{ textAlign: "center", marginBottom: "32px" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: "700", marginBottom: "8px" }}>Create an account</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Enter your details below to sign up</p>
      </div>
      <div>
        <div className="form-group">
          <Label htmlFor="name">Full Name</Label>
          <Input id="name" name="name" type="text" placeholder="John Doe" required autoComplete="name" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="form-group">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="m@example.com" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <PasswordInput name="password" label="Password" required autoComplete="new-password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}/>
        
        {errorMsg && <div className="form-error" style={{ marginBottom: "16px", textAlign: "center" }}>{errorMsg}</div>}
        
        <Button type="submit" variant="secondary" style={{ width: "100%", marginTop: "8px" }} disabled={loading}>
          {loading && <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />}
          Sign Up
        </Button>
      </div>
    </form>
  );
}

function ForgotPasswordForm({ onBackToSignIn }: { onBackToSignIn: () => void }) {
  const [email, setEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/reset-password',
      });
      if (error) {
        setErrorMsg(error.message);
      } else {
        setSuccessMsg('A password reset link has been sent to your email.');
      }
    } catch {
      setErrorMsg('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleReset} autoComplete="on">
      <div style={{ textAlign: "center", marginBottom: "32px" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: "700", marginBottom: "8px" }}>Reset your password</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Enter your email below to receive a reset link</p>
      </div>
      <div>
        <div className="form-group">
          <Label htmlFor="reset-email">Email</Label>
          <Input id="reset-email" name="email" type="email" placeholder="m@example.com" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        
        {errorMsg && <div className="form-error" style={{ marginBottom: "16px", textAlign: "center" }}>{errorMsg}</div>}
        {successMsg && <div style={{ marginBottom: "16px", textAlign: "center", color: "var(--success)", fontSize: "0.9rem" }}>{successMsg}</div>}
        
        <Button type="submit" variant="secondary" style={{ width: "100%", marginTop: "8px" }} disabled={loading}>
          {loading && <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />}
          Send Reset Link
        </Button>

        <div style={{ textAlign: "center", marginTop: "20px" }}>
          <button 
            type="button" 
            onClick={onBackToSignIn} 
            style={{ background: "none", border: "none", color: "var(--accent-primary)", cursor: "pointer", fontSize: "0.85rem", padding: 0 }}
          >
            Back to Sign In
          </button>
        </div>
      </div>
    </form>
  );
}

function AuthFormContainer({ mode, setMode }: { mode: 'signin' | 'signup' | 'forgot'; setMode: (mode: 'signin' | 'signup' | 'forgot') => void; }) {
    return (
        <div style={{ width: "100%", maxWidth: "380px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
            {mode === 'signin' && <SignInForm onForgotPassword={() => setMode('forgot')} />}
            {mode === 'signup' && <SignUpForm />}
            {mode === 'forgot' && <ForgotPasswordForm onBackToSignIn={() => setMode('signin')} />}
            
            {mode !== 'forgot' && (
              <div className="auth-toggle">
                  {mode === 'signin' ? "Don't have an account?" : "Already have an account?"}{" "}
                  <button type="button" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
                      {mode === 'signin' ? "Sign up" : "Sign in"}
                  </button>
              </div>
            )}
            
            <div style={{ position: "relative", textAlign: "center", fontSize: "0.85rem", marginTop: "16px" }}>
                <div style={{ position: "absolute", top: "50%", left: "0", right: "0", borderTop: "1px solid var(--border-primary)", zIndex: 0 }}></div>
                <span style={{ position: "relative", zIndex: 1, padding: "0 12px", background: "var(--bg-primary)", color: "var(--text-muted)" }}>
                  Or continue with
                </span>
            </div>
            
            <Button variant="secondary" type="button" onClick={() => alert("Google login not implemented yet.")} style={{ width: "100%", marginTop: "16px", display: "flex", gap: "8px", alignItems: "center", justifyContent: "center" }}>
                <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google icon" style={{ width: "18px", height: "18px" }} />
                Continue with Google
            </Button>

            <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                By continuing, you agree to our <a href="/terms" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>Terms & Conditions</a> and <a href="/privacy" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>Privacy Policy</a>.
            </div>
        </div>
    )
}

interface AuthContentProps {
    image?: {
        src: string;
        alt: string;
    };
    quote?: {
        text: string;
        author: string;
    }
}

interface AuthUIProps {
    signInContent?: AuthContentProps;
    signUpContent?: AuthContentProps;
}

const defaultSignInContent = {
    image: {
        src: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop",
        alt: "A beautiful abstract design for sign-in"
    },
    quote: {
        text: "Welcome Back! The journey continues.",
        author: "AutometaBot"
    }
};

const defaultSignUpContent = {
    image: {
        src: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2070&auto=format&fit=crop",
        alt: "A vibrant, modern space for new beginnings"
    },
    quote: {
        text: "Create an account. A new chapter awaits.",
        author: "AutometaBot"
    }
};

export function AuthUI({ signInContent = {}, signUpContent = {} }: AuthUIProps) {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');

  const finalSignInContent = {
      image: { ...defaultSignInContent.image, ...signInContent.image },
      quote: { ...defaultSignInContent.quote, ...signInContent.quote },
  };
  const finalSignUpContent = {
      image: { ...defaultSignUpContent.image, ...signUpContent.image },
      quote: { ...defaultSignUpContent.quote, ...signUpContent.quote },
  };

  const currentContent = mode === 'signup' ? finalSignUpContent : finalSignInContent;

  return (
    <div style={{ display: "flex", minHeight: "100vh", width: "100%", background: "var(--bg-primary)" }}>
      <style>{`
        input[type="password"]::-ms-reveal,
        input[type="password"]::-ms-clear {
          display: none;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .5; }
        }
        .auth-hero {
          flex: 1.2;
          position: relative;
          background-size: cover;
          background-position: center;
          transition: background-image 0.5s ease-in-out;
        }
        @media (max-width: 768px) {
          .auth-hero {
            display: none !important;
          }
          .auth-container-mobile {
            padding: 16px !important;
          }
        }
      `}</style>
      
      {/* Left side: Form */}
      <div className="auth-container-mobile" style={{ flex: "1", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px", minWidth: "320px", maxWidth: "600px", margin: "0 auto" }}>
        <AuthFormContainer mode={mode} setMode={setMode} />
      </div>

      {/* Right side: Image cover */}
      <div
        className="auth-hero"
        style={{ 
          backgroundImage: `url(${currentContent.image.src})`
        }}
      >
        <div style={{ position: "absolute", bottom: "0", left: "0", right: "0", height: "150px", background: "linear-gradient(to top, rgba(0,0,0,0.9), transparent)" }} />
        
        <div style={{ position: "relative", zIndex: 10, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", paddingBottom: "40px" }}>
            <blockquote style={{ textAlign: "center", color: "white", textShadow: "0 2px 10px rgba(0,0,0,0.5)", maxWidth: "80%" }}>
              <p style={{ fontSize: "1.5rem", fontWeight: "500", marginBottom: "12px", lineHeight: "1.4" }}>
                “<Typewriter
                    key={currentContent.quote.text}
                    text={currentContent.quote.text}
                    speed={60}
                  />”
              </p>
              <cite style={{ display: "block", fontSize: "1rem", fontWeight: "300", color: "rgba(255,255,255,0.8)", fontStyle: "normal" }}>
                  — {currentContent.quote.author}
              </cite>
            </blockquote>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <AuthUI />;
}
