import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from './ToastContainer';
import { useNavigate, Link } from 'react-router-dom';
import './Auth.css';

interface FormData {
  identifier: string;
  password: string;
}

interface FormErrors {
  identifier?: string;
  password?: string;
  general?: string;
}

const Login: React.FC = () => {
  const { login, isAuthenticated } = useAuth();
  const { showError } = useToast();
  const navigate = useNavigate();

  const [formData, setFormData] = useState<FormData>({
    identifier: '',
    password: ''
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);
  const [rememberMe] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  // Load remember me preference
  useEffect(() => {
    const savedIdentifier = localStorage.getItem('rememberedIdentifier');
    if (savedIdentifier) {
      setFormData(prev => ({ 
        ...prev, 
        identifier: savedIdentifier
      }));
    }
  }, []);

  const validateField = (name: string, value: string): string | undefined => {
    switch (name) {
      case 'identifier':
        if (!value.trim()) return 'Username or email is required';
        return undefined;

      case 'password':
        if (!value) return 'Password is required';
        return undefined;

      default:
        return undefined;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error for this field and validate
    const fieldError = validateField(name, value);
    setErrors(prev => ({ ...prev, [name]: fieldError, general: undefined }));
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    const identifierError = validateField('identifier', formData.identifier);
    const passwordError = validateField('password', formData.password);

    if (identifierError) newErrors.identifier = identifierError;
    if (passwordError) newErrors.password = passwordError;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    // Prevent submit while cooling down
    if (cooldownSeconds > 0) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      const result = await login(
        formData.identifier,
        formData.password,
        rememberMe
      );

      if (result.success) {
        
        navigate('/');
      } else {
        // Show error as toast notification
        showError(result.error || 'Invalid credentials');
        // If server indicates rate limiting, start a short cooldown
        if (typeof result.error === 'string' && /too many requests/i.test(result.error)) {
          setCooldownSeconds(10); // 10 second cooldown
        }
      }
    } catch (error) {
      showError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Countdown effect for cooldownSeconds
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const id = setInterval(() => {
      setCooldownSeconds(prev => {
        if (prev <= 1) {
          clearInterval(id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [cooldownSeconds]);



  // Removed isLoading check so the form always renders

  return (
    <div className="auth-container">
      <div className="auth-card compact">
        <div className="auth-header">
          <div className="auth-logo">
            <img src="/logo.png" alt="Logo" style={{ width: 32, height: 32 }} />
          </div>
          <h1 className="auth-title">Welcome Back</h1>
          <p className="auth-subtitle">Login in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          {cooldownSeconds > 0 && (
            <div className="error-message general-error">
              Too many requests — please wait {cooldownSeconds}s before retrying.
            </div>
          )}
          <div className="form-group">
            <label htmlFor="identifier" className="form-label">
              Username or Email
            </label>
            <input
              type="text"
              id="identifier"
              name="identifier"
              value={formData.identifier}
              onChange={handleInputChange}
              className={`form-input ${errors.identifier ? 'error' : ''}`}
              placeholder="Enter your username or email"
              autoComplete="username"
              disabled={isSubmitting}
            />
            {errors.identifier && (
              <span className="error-message">{errors.identifier}</span>
            )}
          </div>
          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Password
            </label>
            <div className="password-input-container">
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className={`form-input ${errors.password ? 'error' : ''}`}
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={isSubmitting}
              />
            </div>
            {errors.password && (
              <span className="error-message">{errors.password}</span>
            )}
          </div>
          
          <button
            type="submit"
            className="auth-button primary"
            disabled={isSubmitting || cooldownSeconds > 0 || !!errors.identifier || !!errors.password}
          >
            {isSubmitting ? (
              <>
                <span className="button-spinner"></span>
                Signing In...
              </>
            ) : (
              'Login'
            )}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Don't have an account?{' '}
            <Link to="/signup" className="auth-link">
              Create one here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

// Forgot Password Component


export default Login;