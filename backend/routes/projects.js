const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { addSendMessageJob } = require('../queue');
const router = express.Router();

// POST /api/projects - create project config
router.post('/', (req, res) => {
  const { name, description, owner, config } = req.body;
  const id = uuidv4();
  
  if (!name) {
    return res.status(400).json({ success: false, error: 'Project name is required' });
  }
  
  const sql = 'INSERT INTO projects (id, name, description, owner, config, status) VALUES (?, ?, ?, ?, ?, ?)';
  db.run(sql, [id, name, description, owner, JSON.stringify(config || {}), 'stopped'], function(err) {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    res.status(201).json({ 
      success: true, 
      data: { 
        id, 
        name, 
        description, 
        owner, 
        config: config || {}, 
        status: 'stopped' 
      } 
    });
  });
});

// GET /api/projects - list projects
router.get('/', (req, res) => {
  const sql = 'SELECT id, name, description, owner, status, created_at, updated_at FROM projects ORDER BY created_at DESC';
  db.all(sql, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    res.json({ success: true, data: rows });
  });
});

// GET /api/projects/:id - get single project
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const sql = 'SELECT id, name, description, owner, status, config, created_at, updated_at FROM projects WHERE id = ?';
  db.get(sql, [id], (err, row) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    if (!row) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    res.json({ success: true, data: row });
  });
});

// PUT /api/projects/:id - update project
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, description, owner, config } = req.body;
  
  if (!name) {
    return res.status(400).json({ success: false, error: 'Project name is required' });
  }
  
  const sql = 'UPDATE projects SET name = ?, description = ?, owner = ?, config = ?, updated_at = datetime("now") WHERE id = ?';
  db.run(sql, [name, description, owner, JSON.stringify(config || {}), id], function(err) {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    res.json({ 
      success: true, 
      data: { 
        id, 
        name, 
        description, 
        owner, 
        config: config || {} 
      } 
    });
  });
});

// POST /api/projects/:id/run - enqueue and start
router.post('/:id/run', async (req, res) => {
  const { id } = req.params;
  const { started_by, delay_settings, selection_mode } = req.body;
  
  // Check if project exists
  const checkSql = 'SELECT id, status FROM projects WHERE id = ?';
  db.get(checkSql, [id], async (err, row) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    if (!row) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    
    // Update project status to running
    const updateSql = 'UPDATE projects SET status = ? WHERE id = ?';
    db.run(updateSql, ['running', id], function(updateErr) {
      if (updateErr) {
        return res.status(500).json({ success: false, error: updateErr.message });
      }
      
      // Create a process run
      const runId = uuidv4();
      const runSql = 'INSERT INTO process_runs (id, project_id, started_by, status) VALUES (?, ?, ?, ?)';
      db.run(runSql, [runId, id, started_by, 'running'], async function(runErr) {
        if (runErr) {
          return res.status(500).json({ success: false, error: runErr.message });
        }
        
        // Get project targets (channels)
        const targetsSql = 'SELECT channel_id FROM project_targets WHERE project_id = ?';
        db.all(targetsSql, [id], async (targetsErr, targets) => {
          if (targetsErr) {
            return res.status(500).json({ success: false, error: targetsErr.message });
          }
          
          // Get project sessions
          const sessionsSql = 'SELECT session_id FROM project_sessions WHERE project_id = ?';
          db.all(sessionsSql, [id], async (sessionsErr, sessions) => {
            if (sessionsErr) {
              return res.status(500).json({ success: false, error: sessionsErr.message });
            }
            
            // Get project messages
            const messagesSql = 'SELECT id, message_type FROM project_messages WHERE project_id = ?';
            db.all(messagesSql, [id], async (messagesErr, messages) => {
              if (messagesErr) {
                return res.status(500).json({ success: false, error: messagesErr.message });
              }
              
              // New logic: 1 session, sequential per channel
              let jobCount = 0;
              
              if (sessions.length === 0) {
                return res.status(400).json({ success: false, error: 'No sessions found for this project' });
              }
              
              if (targets.length === 0) {
                return res.status(400).json({ success: false, error: 'No target channels found for this project' });
              }
              
              if (messages.length === 0) {
                return res.status(400).json({ success: false, error: 'No messages found for this project. Please add at least one file (text or media).' });
              }
              
              const sessionId = sessions[0].session_id; // Always use first (and only) session
              
              // Determine message structure: text only, media only, or media + caption
              let textMessage = null;
              let mediaMessage = null;
              
              for (const msg of messages) {
                if (msg.message_type === 'text') {
                  textMessage = msg;
                } else if (msg.message_type === 'photo' || msg.message_type === 'video') {
                  mediaMessage = msg;
                }
              }
              
              // Process each channel sequentially with incremental delays
              let jobIndex = 0;
              for (const target of targets) {
                try {
                  if (mediaMessage && textMessage) {
                    // Media with caption from text file
                    await addSendMessageJob(
                      runId, 
                      id, 
                      target.channel_id, 
                      sessionId, 
                      mediaMessage.id,
                      { caption_message_id: textMessage.id, job_index: jobIndex }
                    );
                    jobCount++;
                    jobIndex++;
                  } else if (mediaMessage) {
                    // Media only (no caption)
                    await addSendMessageJob(
                      runId, 
                      id, 
                      target.channel_id, 
                      sessionId, 
                      mediaMessage.id,
                      { job_index: jobIndex }
                    );
                    jobCount++;
                    jobIndex++;
                  } else if (textMessage) {
                    // Text only
                    await addSendMessageJob(
                      runId, 
                      id, 
                      target.channel_id, 
                      sessionId, 
                      textMessage.id,
                      { job_index: jobIndex }
                    );
                    jobCount++;
                    jobIndex++;
                  }
                } catch (jobErr) {
                  console.error('Error adding job to queue:', jobErr);
                }
              }
              
              // Initialize stats with total jobs count
              const initStatsSql = `
                UPDATE process_runs 
                SET stats = json_set(
                  coalesce(stats, '{}'), 
                  '$.total_jobs', ?,
                  '$.completed_jobs', 0,
                  '$.success_count', 0,
                  '$.error_count', 0
                )
                WHERE id = ?
              `;
              db.run(initStatsSql, [jobCount, runId], (statsErr) => {
                if (statsErr) {
                  console.error('Error initializing stats:', statsErr);
                }
              });
              
              res.json({ 
                success: true, 
                data: { 
                  run_id: runId, 
                  project_id: id, 
                  status: 'running',
                  jobs_created: jobCount,
                  message: `Project added to queue successfully with ${jobCount} jobs`
                } 
              });
            });
          });
        });
      });
    });
  });
});

// POST /api/projects/:id/stop - stop
router.post('/:id/stop', (req, res) => {
  const { id } = req.params;
  
  // Update project status to stopped
  const updateProjectSql = 'UPDATE projects SET status = ? WHERE id = ?';
  db.run(updateProjectSql, ['stopped', id], function(err) {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    
    // Update the latest process run status to stopped
    const updateRunSql = 'UPDATE process_runs SET status = ? WHERE project_id = ? AND status = ?';
    db.run(updateRunSql, ['stopped', id, 'running'], function(runErr) {
      if (runErr) {
        return res.status(500).json({ success: false, error: runErr.message });
      }
      
      res.json({ success: true, message: 'Project stopped successfully' });
    });
  });
});

// GET /api/projects/:id/status - status + logs
router.get('/:id/status', (req, res) => {
  const { id } = req.params;
  
  // Get project info
  const projectSql = 'SELECT id, name, status FROM projects WHERE id = ?';
  db.get(projectSql, [id], (err, projectRow) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    if (!projectRow) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    
    // Get latest process run
    const runSql = 'SELECT id, status, stats, created_at, updated_at FROM process_runs WHERE project_id = ? ORDER BY created_at DESC LIMIT 1';
    db.get(runSql, [id], (runErr, runRow) => {
      if (runErr) {
        return res.status(500).json({ success: false, error: runErr.message });
      }
      
      // Get recent logs for the project
      let logs = [];
      if (runRow) {
        const logSql = 'SELECT level, message, created_at FROM logs WHERE run_id = ? ORDER BY created_at DESC LIMIT 20';
        db.all(logSql, [runRow.id], (logErr, logRows) => {
          if (logErr) {
            return res.status(500).json({ success: false, error: logErr.message });
          }
          logs = logRows;
          
          res.json({ 
            success: true, 
            data: { 
              project: projectRow,
              process_run: runRow,
              logs: logs
            } 
          });
        });
      } else {
        res.json({ 
          success: true, 
          data: { 
            project: projectRow,
            process_run: null,
            logs: []
          } 
        });
      }
    });
  });
});

// DELETE /api/projects/:id - delete project
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  
  // First check if project exists
  const checkSql = 'SELECT id, name FROM projects WHERE id = ?';
  db.get(checkSql, [id], (err, row) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    if (!row) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    
    // Delete related data first (due to foreign key constraints)
    const deleteSessionsSql = 'DELETE FROM project_sessions WHERE project_id = ?';
    const deleteTargetsSql = 'DELETE FROM project_targets WHERE project_id = ?';
    const deleteMessagesSql = 'DELETE FROM project_messages WHERE project_id = ?';
    const deleteRunsSql = 'DELETE FROM process_runs WHERE project_id = ?';
    const deleteLogsSql = 'DELETE FROM logs WHERE run_id IN (SELECT id FROM process_runs WHERE project_id = ?)';
    const deleteDelaysSql = 'DELETE FROM delays WHERE project_id = ?';
    
    // Delete logs first (they reference process_runs)
    db.run(deleteLogsSql, [id], (logsErr) => {
      if (logsErr) {
        return res.status(500).json({ success: false, error: logsErr.message });
      }
      
      // Delete process runs
      db.run(deleteRunsSql, [id], (runsErr) => {
        if (runsErr) {
          return res.status(500).json({ success: false, error: runsErr.message });
        }
        
        // Delete project sessions
        db.run(deleteSessionsSql, [id], (sessionsErr) => {
          if (sessionsErr) {
            return res.status(500).json({ success: false, error: sessionsErr.message });
          }
          
          // Delete project targets
          db.run(deleteTargetsSql, [id], (targetsErr) => {
            if (targetsErr) {
              return res.status(500).json({ success: false, error: targetsErr.message });
            }
            
            // Delete project messages
            db.run(deleteMessagesSql, [id], (messagesErr) => {
              if (messagesErr) {
                return res.status(500).json({ success: false, error: messagesErr.message });
              }
              
              // Delete delays
              db.run(deleteDelaysSql, [id], (delaysErr) => {
                if (delaysErr) {
                  return res.status(500).json({ success: false, error: delaysErr.message });
                }
                
                // Finally delete the project itself
                const deleteProjectSql = 'DELETE FROM projects WHERE id = ?';
                db.run(deleteProjectSql, [id], function(projectErr) {
                  if (projectErr) {
                    return res.status(500).json({ success: false, error: projectErr.message });
                  }
                  
                  res.json({ 
                    success: true, 
                    message: `Project "${row.name}" deleted successfully` 
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});

module.exports = router;