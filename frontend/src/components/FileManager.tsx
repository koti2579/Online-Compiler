import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './FileManager.css';

interface CodeFile {
  _id: string;
  filename: string;
  language: string;
  createdAt: string;
  updatedAt: string;
}

interface FileManagerProps {
  onSave: (filename: string) => void;
  onLoad: (filename: string) => void;
  onNew: () => void;
  currentFile: string | null;
}

const FileManager: React.FC<FileManagerProps> = ({
  onSave,
  onLoad,
  onNew,
  currentFile
}) => {
  const [files, setFiles] = useState<CodeFile[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/files');
      const incoming = response.data;
      setFiles(Array.isArray(incoming) ? incoming : []);
    } catch (error) {
      console.error('Failed to fetch files:', error);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!newFileName.trim()) {
      alert('Please enter a filename');
      return;
    }

    try {
      await onSave(newFileName.trim());
      setShowSaveDialog(false);
      setNewFileName('');
      fetchFiles(); // Refresh file list
    } catch (error) {
      console.error('Failed to save file:', error);
    }
  };

  const handleDelete = async (filename: string) => {
    if (!window.confirm(`Are you sure you want to delete "${filename}"?`)) {
      return;
    }

    try {
      await axios.delete(`/files/${filename}`);
      fetchFiles(); // Refresh file list
      if (currentFile === filename) {
        onNew(); // Clear editor if current file was deleted
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete file');
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getLanguageIcon = (language: string) => {
    const icons: Record<string, string> = {
      javascript: '🟨',
      python: '🐍',
      java: '☕',
      cpp: '⚡',
      c: '🔧'
    };
    return icons[language] || '📄';
  };

  return (
    <div className="file-manager">
      <div className="file-manager-header">
        <h3>Files</h3>
        <div className="file-actions">
          <button onClick={onNew} className="action-btn new-btn" title="New File">
            📄
          </button>
          <button 
            onClick={() => setShowSaveDialog(true)} 
            className="action-btn save-btn"
            title="Save File"
          >
            💾
          </button>
          <button 
            onClick={fetchFiles} 
            className="action-btn refresh-btn"
            title="Refresh"
          >
            🔄
          </button>
        </div>
      </div>

      {showSaveDialog && (
        <div className="save-dialog">
          <div className="dialog-content">
            <h4>Save File</h4>
            <input
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="Enter filename..."
              className="filename-input"
              onKeyPress={(e) => e.key === 'Enter' && handleSave()}
              autoFocus
            />
            <div className="dialog-actions">
              <button onClick={handleSave} className="save-confirm-btn">
                Save
              </button>
              <button 
                onClick={() => {
                  setShowSaveDialog(false);
                  setNewFileName('');
                }}
                className="cancel-btn"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="file-list">
        {loading ? (
          <div className="loading-files">Loading files...</div>
          ) : (!Array.isArray(files) || files.length === 0) ? (
          <div className="no-files">
            <p>No files found</p>
            <p>Create your first file by clicking the save button</p>
          </div>
        ) : (
            Array.isArray(files) && files.map((file) => (
            <div
              key={file._id}
              className={`file-item ${currentFile === file.filename ? 'active' : ''}`}
            >
              <div 
                className="file-info"
                onClick={() => onLoad(file.filename)}
              >
                <div className="file-name">
                  <span className="language-icon">
                    {getLanguageIcon(file.language)}
                  </span>
                  <span className="filename">{file.filename}</span>
                </div>
                <div className="file-meta">
                  <span className="language">{file.language === 'php' ? 'plaintext' : (file.language || '-')}</span>
                  <span className="date">{formatDate(file.updatedAt || file.createdAt || '')}</span>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(file.filename);
                }}
                className="delete-btn"
                title="Delete file"
              >
                🗑️
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default FileManager;
