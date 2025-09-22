const express = require('express');
const CodeFile = require('../models/CodeFile');
const auth = require('../middleware/auth');

const router = express.Router();

// Save code file
router.post('/save', auth, async (req, res) => {
  try {
    const { filename, code, language } = req.body;

    // Validation
    if (!filename || !code || !language) {
      return res.status(400).json({ error: 'Filename, code, and language are required' });
    }

    // Check if file already exists for this user
    const existingFile = await CodeFile.findOne({
      userId: req.userId,
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
        userId: req.userId,
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
    res.status(500).json({ error: 'Failed to save file' });
  }
});

// Get user's files
router.get('/', auth, async (req, res) => {
  try {
    const files = await CodeFile.find({ userId: req.userId })
      .select('filename language createdAt updatedAt')
      .sort({ updatedAt: -1 });

    res.json({ files });
  } catch (error) {
    console.error('Get files error:', error);
    res.status(500).json({ error: 'Failed to retrieve files' });
  }
});

// Get specific file
router.get('/:filename', auth, async (req, res) => {
  try {
    const { filename } = req.params;

    const file = await CodeFile.findOne({
      userId: req.userId,
      filename
    });

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({ file });
  } catch (error) {
    console.error('Get file error:', error);
    res.status(500).json({ error: 'Failed to retrieve file' });
  }
});

// Delete file
router.delete('/:filename', auth, async (req, res) => {
  try {
    const { filename } = req.params;

    const file = await CodeFile.findOneAndDelete({
      userId: req.userId,
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