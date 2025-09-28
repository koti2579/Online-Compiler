import React, { useState, useEffect } from 'react';
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

  const languageTemplates: Record<string, string> = {
    javascript: '// JavaScript\nconsole.log("Hello, World!");',
    python: '# Python\nprint("Hello, World!")',
    java: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}',
    cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}',
    c: '#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}',
    php: '<?php\necho "Hello, World!\\n";\n?>'
  };

  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage);
    if (!currentFile) {
      setCode(languageTemplates[newLanguage] || '');
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
      await axios.post('/files/save', {
        filename,
        code,
        language
      });
      setCurrentFile(filename);
      alert('File saved successfully!');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to save file');
    }
  };

  const loadFile = async (filename: string) => {
    try {
      const response = await axios.get(`/files/${filename}`);
      const file = response.data.file;
      setCode(file.code);
      setLanguage(file.language);
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
        <div className="sidebar">
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
              <div className="editor-wrapper">
                <Editor
                  height="100%"
                  language={language}
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
                    insertSpaces: true
                  }}
                />
              </div>
            </div>

            <div className="side-column">
              <div className="panel input-panel">
                <div className="section-header">
                  <h3>Input</h3>
                </div>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Enter input for your program (if needed)..."
                  className="input-textarea"
                />
              </div>

              <div className="panel output-panel">
                <OutputDisplay result={output} loading={loading} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodeEditor;