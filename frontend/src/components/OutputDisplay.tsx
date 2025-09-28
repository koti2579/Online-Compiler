import React from 'react';
import './OutputDisplay.css';

interface ExecutionResult {
  output: string;
  error: string;
  exitCode: number;
  executionTime: number;
}

interface OutputDisplayProps {
  result: ExecutionResult | null;
  loading: boolean;
}

const OutputDisplay: React.FC<OutputDisplayProps> = ({ result, loading }) => {
  const formatExecutionTime = (time: number) => {
    if (time < 1000) {
      return `${time}ms`;
    }
    return `${(time / 1000).toFixed(2)}s`;
  };

  const getStatusIcon = (exitCode: number) => {
    return exitCode === 0 ? '✅' : '❌';
  };

  const getStatusText = (exitCode: number) => {
    return exitCode === 0 ? 'Success' : 'Error';
  };

  if (loading) {
    return (
      <div className="output-display">
        <div className="section-header">
          <h3>Output</h3>
        </div>
        <div className="output-content loading">
          <div className="loading-spinner"></div>
          <span>Executing code...</span>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="output-display">
        <div className="section-header">
          <h3>Output</h3>
        </div>
        <div className="output-content empty">
          <span>Click "Run Code" to see the output</span>
        </div>
      </div>
    );
  }

  return (
    <div className="output-display">
      <div className="section-header">
        <h3>Output</h3>
        <div className="execution-info">
          <span className={`status ${result.exitCode === 0 ? 'success' : 'error'}`}>
            {getStatusIcon(result.exitCode)} {getStatusText(result.exitCode)}
          </span>
          <span className="execution-time">
            ⏱️ {formatExecutionTime(result.executionTime)}
          </span>
        </div>
      </div>
      
      <div className="output-content">
        {result.output && (
          <div className="output-section">
            <h4>Output:</h4>
            <pre className="output-text">{result.output}</pre>
          </div>
        )}
        
        {result.error && (
          <div className="error-section">
            <h4>Error:</h4>
            <pre className="error-text">{result.error}</pre>
          </div>
        )}
        
        {!result.output && !result.error && (
          <div className="no-output">
            <span>No output generated</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default OutputDisplay;