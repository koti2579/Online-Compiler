import React, { useState, useRef, useEffect, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import LanguageSelector from './LanguageSelector';
import OutputDisplay from './OutputDisplay';
import FileManager from './FileManager';
import { useAuth } from '../contexts/AuthContext';

import axios from 'axios';
import './CodeEditor.css';

interface ExecutionResult {
  output: string;
  error: string;
  exitCode: number;
  executionTime: number;
}

const CodeEditor: React.FC = () => {
  const { user, logout } = useAuth();
  
  const [code, setCode] = useState('// Welcome to the Online Code Editor\nconsole.log("Hello, World!");');
  const [language, setLanguage] = useState('javascript');
  const [output, setOutput] = useState<ExecutionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  
  // Refs for scroll containers
  const editorWrapperRef = useRef<HTMLDivElement>(null);
  const inputTextareaRef = useRef<HTMLTextAreaElement>(null);
  const outputContentRef = useRef<HTMLDivElement>(null);

  const languageTemplates: Record<string, string> = {
    javascript: '// JavaScript\nconsole.log("Hello, World!");',
    python: '# Python\nprint("Hello, World!")',
    java: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}',
    cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}',
    c: '#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}'
  };

  // Debounced scroll handler
  const debounce = <T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): ((...args: Parameters<T>) => void) => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    
    return (...args: Parameters<T>) => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  };

  // Handle keyboard navigation for scrollable areas
  const handleKeyDown = (e: React.KeyboardEvent, element: HTMLElement | null) => {
    if (!element) return;
    
    // Alt + Arrow keys for scrolling
    if (e.altKey) {
      const scrollAmount = 50;
      if (e.key === 'ArrowUp') {
        element.scrollTop -= scrollAmount;
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        element.scrollTop += scrollAmount;
        e.preventDefault();
      } else if (e.key === 'ArrowLeft') {
        element.scrollLeft -= scrollAmount;
        e.preventDefault();
      } else if (e.key === 'ArrowRight') {
        element.scrollLeft += scrollAmount;
        e.preventDefault();
      }
    }
    
    // Ctrl + Home/End for top/bottom
    if (e.ctrlKey) {
      if (e.key === 'Home') {
        element.scrollTop = 0;
        e.preventDefault();
      } else if (e.key === 'End') {
        element.scrollTop = element.scrollHeight;
        e.preventDefault();
      }
    }
  };

  // Clean up event listeners on unmount
  useEffect(() => {
    return () => {
      // Cleanup function
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Debounced resize handler for performance
  const handleResize = debounce(() => {
    // Recalculate any necessary dimensions
    if (editorWrapperRef.current) {
      // Force editor layout update if needed
    }
  }, 100);

  // Add resize listener
  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const toEditorLanguage = (lang: string, filename?: string | null) => {
    const ext = (filename || '').toLowerCase();
    if (lang === 'php' || ext.endsWith('.php') || ext.endsWith('.phtml')) {
      return 'plaintext';
    }
    return lang;
  };

  const handleLanguageChange = (newLanguage: string) => {
    const effective = toEditorLanguage(newLanguage, currentFile);
    setLanguage(effective);
    if (!currentFile) {
      setCode(languageTemplates[effective] || '');
    }
  };

  const executeCode = async () => {
    if (!code.trim()) {
      setOutput({
        output: '',
        error: 'No code to execute',
        exitCode: 1,
        executionTime: 0
      });
      return;
    }

    setLoading(true);
    setOutput(null);

    try {
      const response = await axios.post('/code/execute', {
        code,
        language,
        input
      });

      setOutput(response.data.result);
    } catch (error: any) {
      setOutput({
        output: '',
        error: error.response?.data?.error || 'Execution failed',
        exitCode: 1,
        executionTime: 0
      });
    } finally {
      setLoading(false);
    }
  };

  const saveFile = async (filename: string) => {
    try {
      await axios.post('/files', {
        filename,
        code,
        language
      });
      setCurrentFile(filename);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to save file');
    }
  };

  const loadFile = async (filename: string) => {
    try {
      const response = await axios.get(`/files/${filename}`);
      const file = response.data.file;
      setCode(file.code);
      setLanguage(toEditorLanguage(file.language, filename));
      setCurrentFile(filename);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to load file');
    }
  };

  const newFile = () => {
    setCode(languageTemplates[language] || '');
    setCurrentFile(null);
    setOutput(null);
  };

  return (
    <div className="code-editor-container">
      <header className="editor-header">
        <div className="header-left">
          <h1>Online Code Editor</h1>
          <span className="user-info">Welcome, {user?.username}</span>
        </div>
        <div className="header-right">
          <button onClick={logout} className="logout-btn">
            Logout
          </button>
        </div>
      </header>

      <div className="editor-layout">
        <div 
          className="sidebar"
          role="navigation"
          aria-label="File navigation"
          tabIndex={0}
          onKeyDown={(e) => handleKeyDown(e, e.currentTarget)}
        >
          <FileManager
            onSave={saveFile}
            onLoad={loadFile}
            onNew={newFile}
            currentFile={currentFile}
          />
        </div>

        <div className="main-content">
          <div className="editor-controls">
            <LanguageSelector
              selectedLanguage={language}
              onLanguageChange={handleLanguageChange}
            />
            <button
              onClick={executeCode}
              disabled={loading}
              className="run-btn"
              aria-label={loading ? 'Running code' : 'Run code'}
            >
              {loading ? 'Running...' : 'Run Code'}
            </button>
          </div>

          <div className="workspace">
            <div className="code-column">
              <div className="section-header">
                <h3>Code Editor</h3>
                {currentFile && <span className="file-indicator">File: {currentFile}</span>}
              </div>
              <div 
                className="editor-wrapper" 
                ref={editorWrapperRef}
                tabIndex={-1}
              >
                <Editor
                  height="100%"
                  language={toEditorLanguage(language, currentFile)}
                  value={code}
                  onChange={(value) => setCode(value || '')}
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: 'on',
                    roundedSelection: false,
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                    insertSpaces: true,
                    scrollbar: {
                      useShadows: false,
                      verticalHasArrows: true,
                      horizontalHasArrows: true,
                      vertical: 'visible',
                      horizontal: 'visible',
                      verticalScrollbarSize: 10,
                      horizontalScrollbarSize: 10,
                      arrowSize: 15
                    },
                    accessibilitySupport: 'on'
                  }}
                  aria-label="Code editor"
                />
              </div>
            </div>

            <div className="side-column">
              <div className="panel input-panel">
                <div className="section-header">
                  <h3>Input</h3>
                </div>
                <textarea
                  ref={inputTextareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Enter input for your program (if needed)..."
                  className="input-textarea"
                  aria-label="Program input"
                  onKeyDown={(e) => handleKeyDown(e, inputTextareaRef.current)}
                />
              </div>

              <div className="panel output-panel">
                <OutputDisplay 
                  result={output} 
                  loading={loading} 
                  outputRef={outputContentRef}
                  onKeyDown={(e) => handleKeyDown(e, outputContentRef.current)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodeEditor;