const express = require('express');
const CodeFile = require('../models/CodeFile');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Use auth middleware alias for consistency with existing code
const auth = authenticateToken;

// Save code file
router.post('/save', auth, async (req, res) => {
  try {
    const { filename, code, language } = req.body;

    // Validation
    if (!filename || !code || !language) {
      return res.status(400).json({ error: 'Filename, code, and language are required' });
    }

    // Additional validation
    if (!filename.trim()) {
      return res.status(400).json({ error: 'Filename cannot be empty' });
    }

    if (!code.trim()) {
      return res.status(400).json({ error: 'Code cannot be empty' });
    }

    // Check if file already exists for this user
    const existingFile = await CodeFile.findOne({
      userId: req.user._id,
      filename
    });

    if (existingFile) {
      // Update existing file
      existingFile.code = code;
      existingFile.language = language;
      existingFile.updatedAt = new Date();
      await existingFile.save();

      res.json({
        message: 'File updated successfully',
        file: existingFile
      });
    } else {
      // Create new file
      const codeFile = new CodeFile({
        userId: req.user._id,
        filename,
        code,
        language
      });

      await codeFile.save();

      res.status(201).json({
        message: 'File saved successfully',
        file: codeFile
      });
    }
  } catch (error) {
    console.error('Save file error:', error);
    res.status(500).json({ 
      error: 'Failed to save file, check database connection.',
      details: error.message 
    });
  }
});

// Get all files for a user
router.get('/', auth, async (req, res) => {
  try {
    const files = await CodeFile.find({ userId: req.user._id }).select('-code');
    
    res.json(files);
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get a specific file
router.get('/:id', auth, async (req, res) => {
  try {
    const file = await CodeFile.findById(req.params.id);
    
    if (!file || file.userId.toString() !== req.user._id.toString()) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.json(file);
  } catch (error) {
    console.error('Error fetching file:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete file
router.delete('/:filename', auth, async (req, res) => {
  try {
    const { filename } = req.params;

    const file = await CodeFile.findOneAndDelete({
      userId: req.user._id,
      filename
    });

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

module.exports = router;