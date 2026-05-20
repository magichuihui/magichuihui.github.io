(function () {
  'use strict';

  var term = {
    screen: null,
    input: null,
    history: [],
    historyIndex: -1,
    commands: {},
    buffer: [],
    booting: true,
    posts: []
  };

  var ASCII_BANNER = [
    '%cpurple%  ██╗  ██╗██╗   ██╗██████╗  █████╗ ',
    '%cpurple%  ██║ ██╔╝╚██╗ ██╔╝██╔══██╗██╔══██╗',
    '%cpurple%  █████╔╝  ╚████╔╝ ██████╔╝███████║',
    '%cpurple%  ██╔═██╗   ╚██╔╝  ██╔══██╗██╔══██║',
    '%cpurple%  ██║  ██╗   ██║   ██║  ██║██║  ██║',
    '%cpurple%  ╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝',
    ''
  ];

  var BOOT_MESSAGES = [
    { text: ' Booting KyraOS v1.0.0 ...', cls: 'boot-ok' },
    { text: ' [  OK  ] Loaded kernel module: kyra_core', cls: 'boot-ok' },
    { text: ' [  OK  ] Initialized networking stack', cls: 'boot-ok' },
    { text: ' [  OK  ] Mounted /home filesystem', cls: 'boot-ok' },
    { text: ' [  OK  ] Started blog engine (Jekyll)', cls: 'boot-ok' },
    { text: ' [  OK  ] Loaded ' + (window._terminalPosts ? window._terminalPosts.length : 0) + ' blog posts', cls: 'boot-ok' },
    { text: ' [  OK  ] Ready on port 443', cls: 'boot-ok' },
    { text: '', cls: '' }
  ];

  var SKILLS = [
    { key: 'Kubernetes', value: 'Cluster ops, Helm, Istio, Calico, ArgoCD' },
    { key: 'CI/CD', value: 'GitHub Actions, GitLab CI, ArgoCD, Jenkins' },
    { key: 'Infra as Code', value: 'Terraform, Helm, Ansible' },
    { key: 'Security', value: 'Vault, Let\'s Encrypt, mTLS, OIDC' },
    { key: 'Networking', value: 'OpenWRT, Calico, BGP, nftables' },
    { key: 'Storage', value: 'Ceph, Rook, Longhorn' },
    { key: 'Observability', value: 'Elasticsearch, Prometheus, Grafana' },
    { key: 'Languages', value: 'Go, Python, Bash, Lua' }
  ];

  var CONTACT = [
    { key: 'GitHub', value: 'github.com/magichuihui' },
    { key: 'Blog', value: 'blog.amyinfo.com' }
  ];

  var ABOUT_TEXT = [
    'Infrastructure & Platform Engineer. I write about Kubernetes,',
    'cloud-native technologies, networking, and infrastructure automation.',
    '',
    'This site is a collection of notes, guides, and hard-won lessons',
    'from running production systems.'
  ];

  var WHOAMI_TEXT = [
    'Login: magichuihui',
    'Name: Kyra',
    'Shell: /bin/bash',
    'Home: /home/kyra',
    'Site: blog.amyinfo.com',
    'Uptime: varies',
    'VM: walking on clouds (and bare metal)'
  ];

  var UPTIME_JOKES = [
    'up ' + Math.floor(Math.random() * 365 + 1) + ' days, ' + Math.floor(Math.random() * 24) + ' hours (since last existential crisis)',
    'up ' + Math.floor(Math.random() * 99 + 1) + ' days — kernel panics: 0, caffeine crashes: ' + Math.floor(Math.random() * 42 + 1),
    'up way too long, should probably reboot soon (famous last words)'
  ];

  function init() {
    term.screen = document.getElementById('terminal-screen');
    term.input = document.getElementById('terminal-input');
    term.posts = window._terminalPosts || [];

    registerCommands();
    bindEvents();
    bootSequence();
  }

  function registerCommands() {
    addCommand('help', cmdHelp, 'Show this help message');
    addCommand('ls', cmdPosts, 'List recent blog posts');
    addCommand('posts', cmdPosts, 'Alias for ls');
    addCommand('about', cmdAbout, 'About this site');
    addCommand('skills', cmdSkills, 'Show tech stack');
    addCommand('whoami', cmdWhoami, 'Display user info');
    addCommand('neofetch', cmdNeofetch, 'Display system info');
    addCommand('contact', cmdContact, 'Show contact info');
    addCommand('banner', cmdBanner, 'Display the startup banner');
    addCommand('clear', cmdClear, 'Clear the terminal');
    addCommand('date', cmdDate, 'Show current date/time');
    addCommand('uptime', cmdUptime, 'Show system uptime');
    addCommand('history', cmdHistory, 'Show command history');
    addCommand('github', cmdGithub, 'Open GitHub profile');
    addCommand('repo', cmdRepo, 'Open site source code');
    addCommand('echo', cmdEcho, 'Echo the input text');
    addCommand('uname', cmdUname, 'Print system information');
  }

  function addCommand(name, fn, description) {
    term.commands[name] = { fn: fn, desc: description };
  }

  function bindEvents() {
    term.input.addEventListener('keydown', function (e) {
      if (term.booting) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        var cmd = term.input.value.trim();
        processCommand(cmd);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        navigateHistory(-1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        navigateHistory(1);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        doTabCompletion();
      }
    });

    term.screen.addEventListener('click', function () {
      if (!term.booting) term.input.focus();
    });
  }

  function bootSequence() {
    term.booting = true;
    term.input.disabled = true;
    var inputLine = document.getElementById('terminal-input-line');
    if (inputLine) inputLine.style.display = 'none';

    var lines = [];

    // Boot messages
    BOOT_MESSAGES.forEach(function (msg) {
      lines.push({ text: msg.text, cls: msg.cls, delay: 60 });
    });

    // ASCII banner
    ASCII_BANNER.forEach(function (line) {
      lines.push({ text: line, cls: 'ascii', delay: 20 });
    });

    // Welcome line
    lines.push({ text: 'Welcome to Kyra\'s home — blog.amyinfo.com', cls: 'green bold', delay: 80 });
    lines.push({ text: 'Type \'help\' for available commands.', cls: 'dim', delay: 60 });
    lines.push({ text: '', cls: '', delay: 40 });

    typeLines(lines, 0, function () {
      term.booting = false;
      term.input.disabled = false;
      var inputLine = document.getElementById('terminal-input-line');
      if (inputLine) inputLine.style.display = '';
      term.input.focus();
      showPrompt();
    });
  }

  function typeLines(lines, index, callback) {
    if (index >= lines.length) {
      if (callback) callback();
      return;
    }

    var line = lines[index];
    addOutput(line.text, line.cls, line.delay > 0);

    if (line.delay > 0) {
      setTimeout(function () {
        typeLines(lines, index + 1, callback);
      }, line.delay);
    } else {
      typeLines(lines, index + 1, callback);
    }
  }

  function addOutput(text, cls, animated) {
    if (!text && text !== '') return;

    var line = document.createElement('div');
    line.className = 'terminal-line' + (cls ? ' ' + cls : '');

    if (animated) {
      line.textContent = '';
      term.screen.appendChild(line);
      typeText(line, text, 0, 8);
    } else {
      if (cls === 'ascii') {
        line.className = 'terminal-line terminal-ascii';
        line.textContent = text;
      } else {
        line.textContent = text;
      }
      term.screen.appendChild(line);
    }

    scrollToBottom();
  }

  function typeText(element, text, index, speed) {
    if (index < text.length) {
      element.textContent += text[index];
      scrollToBottom();
      setTimeout(function () {
        typeText(element, text, index + 1, speed);
      }, speed);
    }
  }

  function scrollToBottom() {
    term.screen.scrollTop = term.screen.scrollHeight;
  }

  function showPrompt() {
    var promptEl = document.querySelector('.terminal-prompt');
    if (promptEl) {
      promptEl.textContent = 'guest@kyraos:~$';
    }
  }

  function processCommand(input) {
    if (!input) {
      renderPromptLine(input, '');
      return;
    }

    term.history.push(input);
    term.historyIndex = term.history.length;

    var parts = input.split(/\s+/);
    var cmdName = parts[0].toLowerCase();
    var args = parts.slice(1).join(' ');

    var cmd = term.commands[cmdName];

    if (cmd) {
      renderPromptLine(input, '');
      cmd.fn(args);
    } else {
      renderPromptLine(input, '');
      addOutput(input + ': command not found', 'red');
      addOutput('Type \'help\' for available commands.', 'dim');
    }

    term.input.value = '';
    scrollToBottom();
  }

  function renderPromptLine(input, output) {
    var line = document.createElement('div');
    line.className = 'terminal-line';
    line.innerHTML = '<span class="terminal-prompt-inline" style="color:var(--terminal-prompt)">guest@kyraos:~$</span> '
      + escapeHtml(input);
    term.screen.appendChild(line);
  }

  function navigateHistory(direction) {
    if (term.history.length === 0) return;

    term.historyIndex += direction;

    if (term.historyIndex < 0) {
      term.historyIndex = -1;
      term.input.value = '';
      return;
    }

    if (term.historyIndex >= term.history.length) {
      term.historyIndex = term.history.length;
      term.input.value = '';
      return;
    }

    term.input.value = term.history[term.historyIndex];
    // Move cursor to end
    setTimeout(function () {
      term.input.selectionStart = term.input.selectionEnd = term.input.value.length;
    }, 0);
  }

  function doTabCompletion() {
    var input = term.input.value.trim();
    if (!input) return;

    var parts = input.split(/\s+/);
    var partial = parts[0].toLowerCase();

    var matches = Object.keys(term.commands).filter(function (cmd) {
      return cmd.indexOf(partial) === 0;
    });

    if (matches.length === 1) {
      var rest = parts.slice(1).join(' ');
      term.input.value = matches[0] + (rest ? ' ' + rest : ' ');
    } else if (matches.length > 1) {
      renderPromptLine(term.input.value, '');
      addOutput(matches.join('  '), 'comment');
    }
  }

  // ========== COMMAND HANDLERS ==========

  function cmdHelp() {
    addOutput('Available commands:', 'green bold');
    addOutput('');

    var cmdNames = Object.keys(term.commands).sort();

    cmdNames.forEach(function (name) {
      var cmd = term.commands[name];
      if (name === 'posts') return;
      var desc = cmd.desc || '';
      addOutput('  ' + padRight(name, 12) + '  ' + desc);
    });

    addOutput('');
    addOutput('Tab completion available.', 'dim');
  }

  function cmdPosts() {
    if (term.posts.length === 0) {
      addOutput('No posts found.', 'amber');
      return;
    }

    addOutput('Recent posts:', 'green bold');
    addOutput('');

    term.posts.forEach(function (post, i) {
      var num = String(i + 1);
      var title = post.title;
      var date = post.date || '';
      var url = post.url || '#';
      var lineEl = document.createElement('div');
      lineEl.className = 'terminal-line terminal-post-entry';
      lineEl.innerHTML = '<span style="color:var(--terminal-comment)">' + padRight(num, 3) + '</span>'
        + '<a class="terminal-post-title" href="' + url + '">' + escapeHtml(title) + '</a>'
        + '<span class="terminal-post-date">' + date + '</span>';
      term.screen.appendChild(lineEl);
    });

    addOutput('');
    addOutput('Click a post to read it, or visit the blog feed below.', 'dim');
  }

  function cmdAbout() {
    addOutput('About', 'green bold');
    addOutput('');
    ABOUT_TEXT.forEach(function (line) {
      addOutput(line);
    });
  }

  function cmdSkills() {
    addOutput('Skills & Technologies', 'green bold');
    addOutput('');
    SKILLS.forEach(function (s) {
      addOutput('  ' + padRight(s.key, 18) + s.value);
    });
  }

  function cmdWhoami() {
    addOutput('');
    WHOAMI_TEXT.forEach(function (line) {
      addOutput(line);
    });
    addOutput('');
  }

  function cmdNeofetch() {
    addOutput('');
    addOutput('          .-\'`' + padRight('`' + '`' + '\'-.', 30), 'amber');
    addOutput('        .\'  ' + '   ' + '    `'.replace(/\s+/, ' '), 'amber');
    addOutput('       /    ' + 'KyraOS' + '    \\', 'amber');
    addOutput('      ;    ' + 'v1.0.0' + '     ;', 'amber');
    addOutput('      |              |', 'amber');
    addOutput('      ;              ;', 'amber');
    addOutput('       \\            /', 'amber');
    addOutput('        `.        .\'', 'amber');
    addOutput('          `-...-\'', 'amber');
    addOutput('');
    addOutput('  ' + padRight('Host', 14) + 'Kyra\'s home', 'cyan');
    addOutput('  ' + padRight('Kernel', 14) + 'KyraOS v1.0.0', 'cyan');
    addOutput('  ' + padRight('Shell', 14) + '/bin/bash', 'cyan');
    addOutput('  ' + padRight('Posts', 14) + term.posts.length + ' articles', 'cyan');
    addOutput('  ' + padRight('Uptime', 14) + 'long enough', 'cyan');
    addOutput('');
  }

  function cmdContact() {
    addOutput('Contact', 'green bold');
    addOutput('');
    CONTACT.forEach(function (c) {
      addOutput('  ' + padRight(c.key, 12) + c.value);
    });
    addOutput('');
    addOutput('I\'m also active on the Fediverse & various Kubernetes communities.', 'dim');
  }

  function cmdBanner() {
    addOutput('');
    ASCII_BANNER.forEach(function (line) {
      if (line) {
        var el = document.createElement('div');
        el.className = 'terminal-line terminal-ascii';
        el.textContent = line.replace(/%c\w+%/g, '');
        term.screen.appendChild(el);
      } else {
        addOutput('');
      }
    });
    addOutput('Welcome back!', 'green');
  }

  function cmdClear() {
    term.screen.innerHTML = '';
    term.input.value = '';
    term.input.focus();
  }

  function cmdDate() {
    var now = new Date();
    addOutput(now.toString(), 'green');
  }

  function cmdUptime() {
    var joke = UPTIME_JOKES[Math.floor(Math.random() * UPTIME_JOKES.length)];
    addOutput(' ' + joke, 'amber');
  }

  function cmdHistory() {
    if (term.history.length === 0) {
      addOutput('No commands in history.', 'dim');
      return;
    }

    addOutput('');
    term.history.forEach(function (cmd, i) {
      addOutput('  ' + String(i + 1) + '  ' + cmd);
    });
    addOutput('');
  }

  function cmdGithub() {
    addOutput('Opening GitHub profile...', 'green');
    addOutput('https://github.com/magichuihui', 'blue');
    window.open('https://github.com/magichuihui', '_blank');
  }

  function cmdRepo() {
    addOutput('Opening source code...', 'green');
    addOutput('https://github.com/magichuihui/magichuihui.github.io', 'blue');
    window.open('https://github.com/magichuihui/magichuihui.github.io', '_blank');
  }

  function cmdEcho(args) {
    if (args) {
      addOutput(args, 'green');
    }
  }

  function cmdUname() {
    addOutput('KyraOS kyra-blog 6.8.0-kyra #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux', 'green');
  }

  // ========== UTILITIES ==========

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function padRight(str, len) {
    str = String(str);
    while (str.length < len) {
      str += ' ';
    }
    return str;
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
