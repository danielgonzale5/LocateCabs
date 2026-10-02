// Test cases for shell-exec.yaml (semgrep --test).
var systemchild = require('child_process');

app.post('/github', function (req, res) {
  // ruleid: child-process-through-a-shell
  systemchild.exec('cd /home/ubuntu/LocateCabs && git reset --hard && git pull');
});

// ok: child-process-through-a-shell
systemchild.execFile('git', ['-C', dir, 'fetch', '--quiet', 'origin', branch], callback);

// ok: child-process-through-a-shell
const match = /^Basic (.+)$/.exec(header);
