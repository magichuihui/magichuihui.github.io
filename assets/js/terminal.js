(function () {
  'use strict';

  /* ===== STATE ===== */
  var term = {
    screen: null,
    input: null,
    overlay: null,
    returnBtn: null,
    history: [],
    historyIndex: -1,
    commands: {},
    booting: true,
    posts: [],
    tags: [],
    site: {},
    exitBtn: null,
    pipeActive: false,
    pipeBuffer: null,
    gameActive: false
  };

  /* ===== DATA ===== */
  var ASCII_BANNER = [
    '  ██╗  ██╗██╗   ██╗██████╗  █████╗ ',
    '  ██║ ██╔╝╚██╗ ██╔╝██╔══██╗██╔══██╗',
    '  █████╔╝  ╚████╔╝ ██████╔╝███████║',
    '  ██╔═██╗   ╚██╔╝  ██╔══██╗██╔══██║',
    '  ██║  ██╗   ██║   ██║  ██║██║  ██║',
    '  ╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝',
    ''
  ];

  var UPTIME_JOKES = [
    'up ' + Math.floor(Math.random() * 365 + 1) + ' days, ' + Math.floor(Math.random() * 24) + ' hours',
    'up ' + Math.floor(Math.random() * 99 + 1) + ' days - panics: 0, caffeine: ' + Math.floor(Math.random() * 42 + 1),
    'up way too long, should probably reboot soon'
  ];

  var SKILLS = [
    { key: 'Kubernetes', value: 'Cluster ops, Helm, Istio, Calico, ArgoCD' },
    { key: 'CI/CD', value: 'GitHub Actions, GitLab CI, ArgoCD' },
    { key: 'Infra as Code', value: 'Terraform, Helm, Ansible' },
    { key: 'Security', value: 'Vault, Lets Encrypt, mTLS, OIDC' },
    { key: 'Networking', value: 'OpenWRT, Calico, BGP, nftables' },
    { key: 'Storage', value: 'Ceph, Rook, Longhorn' },
    { key: 'Observability', value: 'Elasticsearch, Prometheus, Grafana' },
    { key: 'Languages', value: 'Go, Python, Bash, Lua' }
  ];

  /* ===== INIT ===== */
  function init() {
    term.overlay = document.getElementById('terminal-overlay');
    term.screen = document.getElementById('terminal-screen');
    term.input = document.getElementById('terminal-input');
    term.exitBtn = document.getElementById('terminal-exit-btn');
    term.returnBtn = document.getElementById('terminal-return-btn');
    term.posts = window._terminalPosts || [];
    term.tags = window._terminalTags || [];
    term.site = window._terminalSite || {};

    registerCommands();
    bindEvents();
    bootSequence();
  }

  /* ===== COMMAND SYSTEM ===== */
  function registerCommands() {
    addCommand('help',     cmdHelp,    'Show this help message');
    addCommand('ls',       cmdLs,      'List blog posts (use -l for detail, -a for all)');
    addCommand('cat',      cmdCat,     'cat <n> | cat <title> — open a post');
    addCommand('open',     cmdCat,     'open <n> | open <title> — alias for cat');
    addCommand('search',   cmdSearch,  'search <query> — search blog posts');
    addCommand('tags',     cmdTags,    'List all tags');
    addCommand('tag',      cmdTag,     'tag <name> — show posts by tag');
    addCommand('random',   cmdRandom,  'Show a random post (preview)');
    addCommand('latest',   cmdLatest,  'Show the newest post (preview)');
    addCommand('about',    cmdAbout,   'About this site');
    addCommand('skills',   cmdSkills,  'Show tech stack');
    addCommand('whoami',   cmdWhoami,  'Display user info');
    addCommand('neofetch', cmdNeofetch,'Display system info');
    addCommand('contact',  cmdContact, 'Show contact info');
    addCommand('social',   cmdSocial,  'Show social media links');
    addCommand('github',   cmdGithub,  'Open GitHub profile');
    addCommand('repo',     cmdRepo,    'Open site source code');
    addCommand('date',     cmdDate,    'Show current date/time');
    addCommand('uptime',   cmdUptime,  'Show system uptime');
    addCommand('history',  cmdHistory, 'Show command history');
    addCommand('echo',     cmdEcho,    'Echo text: echo <message>');
    addCommand('uname',    cmdUname,   'Print system information');
    addCommand('clear',    cmdClear,   'Clear the terminal');
    addCommand('banner',   cmdBanner,  'Display the startup banner');
    addCommand('exit',     cmdExit,    'Exit terminal to standard view');
    addCommand('play',     cmdPlay,    'Play a space shooter game');
    addCommand('man',      cmdHelp,    'Alias for help');
  }

  function addCommand(name, fn, desc) {
    term.commands[name] = { fn: fn, desc: desc };
  }

  /* ===== EVENTS ===== */
  function bindEvents() {
    term.input.addEventListener('keydown', function (e) {
      if (term.booting) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        processCommand(term.input.value.trim());
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

    term.exitBtn.addEventListener('click', function () {
      if (!term.booting) exitToNormal();
    });

    term.returnBtn.addEventListener('click', function () {
      enterTerminalMode();
    });
  }

  /* ===== BOOT SEQUENCE ===== */
  function bootSequence() {
    term.booting = true;
    term.input.disabled = true;
    hideEl('terminal-input-line');
    // Only lock body scroll when terminal starts visible (homepage)
    if (!term.overlay.classList.contains('hidden')) {
      document.body.style.overflow = 'hidden';
    }

    var lines = [];
    lines.push({ text: ' Booting KyraOS v1.0.0 ...',                   cls: 'boot-ok', delay: 50 });
    lines.push({ text: ' [  OK  ] Loaded kernel module: kyra_core',      cls: 'boot-ok', delay: 40 });
    lines.push({ text: ' [  OK  ] Initialized networking stack',         cls: 'boot-ok', delay: 40 });
    lines.push({ text: ' [  OK  ] Mounted /home filesystem',             cls: 'boot-ok', delay: 40 });
    lines.push({ text: ' [  OK  ] Started blog engine (Jekyll)',         cls: 'boot-ok', delay: 40 });
    lines.push({ text: ' [  OK  ] Loaded ' + term.posts.length + ' blog posts', cls: 'boot-ok', delay: 40 });
    lines.push({ text: ' [  OK  ] Loaded ' + term.tags.length + ' unique tags', cls: 'boot-ok', delay: 40 });
    lines.push({ text: ' [  OK  ] Ready on port 443',                    cls: 'boot-ok', delay: 50 });
    lines.push({ text: '', cls: '', delay: 30 });
    ASCII_BANNER.forEach(function (l) { lines.push({ text: l, cls: 'ascii', delay: 15 }); });
    lines.push({ text: '  Welcome to ' + (term.site.title || 'Kyra\'s home') + ' — ' + (term.site.url || 'blog.amyinfo.com'), cls: 'green bold', delay: 60 });
    lines.push({ text: '  Type \'help\' for available commands. Type \'exit\' for standard view.', cls: 'dim', delay: 50 });
    lines.push({ text: '', cls: '', delay: 30 });

    typeLines(lines, 0, function () {
      term.booting = false;
      term.input.disabled = false;
      showEl('terminal-input-line');
      term.input.focus();
    });
  }

  /* ===== TYPEWRITER EFFECT ===== */
  function typeLines(lines, idx, done) {
    if (idx >= lines.length) { if (done) done(); return; }
    var l = lines[idx];
    addOutput(l.text, l.cls, l.delay > 0);
    if (l.delay > 0) {
      setTimeout(function () { typeLines(lines, idx + 1, done); }, l.delay);
    } else {
      typeLines(lines, idx + 1, done);
    }
  }

  function addOutput(text, cls, animated) {
    if (text === undefined) return;
    var el = document.createElement('div');
    el.className = 'terminal-line' + (cls ? ' ' + cls : '');
    if (animated && text) {
      el.textContent = '';
      term.screen.appendChild(el);
      typeText(el, text, 0, 6);
    } else {
      if (cls === 'ascii') {
        el.className = 'terminal-line terminal-ascii';
      }
      el.textContent = text;
      term.screen.appendChild(el);
    }
    scrollBottom();
  }

  function typeText(el, text, i, speed) {
    if (i < text.length) {
      el.textContent += text[i];
      scrollBottom();
      setTimeout(function () { typeText(el, text, i + 1, speed); }, speed);
    }
  }

  function addOutputRaw(html, cls) {
    var el = document.createElement('div');
    el.className = 'terminal-line' + (cls ? ' ' + cls : '');
    el.innerHTML = html;
    term.screen.appendChild(el);
    scrollBottom();
  }

  function scrollBottom() {
    term.screen.scrollTop = term.screen.scrollHeight;
  }

  function showEl(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = '';
  }

  function hideEl(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  }

  /* ===== INPUT PROCESSING ===== */
  function processCommand(input) {
    if (!input) {
      renderPromptLine('');
      return;
    }
    term.history.push(input);
    term.historyIndex = term.history.length;
    renderPromptLine(input);

    // Handle pipe: left | right
    var pipeIdx = input.indexOf('|');
    if (pipeIdx !== -1) {
      var left = input.substring(0, pipeIdx).trim();
      var right = input.substring(pipeIdx + 1).trim();
      if (left && right) {
        processPipe(left, right);
        term.input.value = '';
        scrollBottom();
        return;
      }
    }

    var parts = input.split(/\s+/);
    var cmdName = parts[0].toLowerCase();
    var args = parts.slice(1).join(' ');

    var cmd = term.commands[cmdName];
    if (cmd) {
      cmd.fn(args);
    } else {
      addOutput(input + ': command not found', 'red');
      addOutput('Type \'help\' for available commands.', 'dim');
    }
    term.input.value = '';
    scrollBottom();
  }

  function processPipe(left, right) {
    term.pipeActive = true;
    term.pipeBuffer = null;

    // Execute left command
    var leftParts = left.split(/\s+/);
    var leftCmdName = leftParts[0].toLowerCase();
    var leftArgs = leftParts.slice(1).join(' ');
    var leftCmd = term.commands[leftCmdName];

    if (!leftCmd) {
      addOutput(left + ': command not found', 'red');
      term.pipeActive = false;
      return;
    }
    leftCmd.fn(leftArgs);

    term.pipeActive = false;

    // If left produced pipe output, pass to right command
    if (term.pipeBuffer !== null) {
      var rightParts = right.split(/\s+/);
      var rightCmdName = rightParts[0].toLowerCase();
      var rightArgs = rightParts.slice(1).join(' ');
      var rightCmd = term.commands[rightCmdName];

      if (!rightCmd) {
        addOutput(right + ': command not found', 'red');
        return;
      }
      // Prepend pipe output to right command args
      var finalArgs = String(term.pipeBuffer) + (rightArgs ? ' ' + rightArgs : '');
      rightCmd.fn(finalArgs);
    }
    term.pipeBuffer = null;
  }

  function renderPromptLine(input) {
    addOutputRaw(
      '<span style="color:var(--terminal-prompt)">guest@kyraos:~$</span> '
      + escapeHtml(input)
    );
  }

  /* ===== NAVIGATION ===== */
  function navigateHistory(dir) {
    if (!term.history.length) return;
    term.historyIndex += dir;
    if (term.historyIndex < 0) { term.historyIndex = -1; term.input.value = ''; return; }
    if (term.historyIndex >= term.history.length) { term.historyIndex = term.history.length; term.input.value = ''; return; }
    term.input.value = term.history[term.historyIndex];
    setTimeout(function () {
      term.input.selectionStart = term.input.selectionEnd = term.input.value.length;
    }, 0);
  }

  function doTabCompletion() {
    var val = term.input.value;
    if (!val.trim()) return;

    var pipeIdx = val.lastIndexOf('|');
    var pipeActive = pipeIdx !== -1;

    var beforePartial, partial;
    if (pipeActive) {
      beforePartial = val.substring(0, pipeIdx + 1);
      if (beforePartial.charAt(beforePartial.length - 1) !== ' ') {
        beforePartial += ' ';
      }
      partial = val.substring(pipeIdx + 1).trim();
    } else {
      beforePartial = '';
      var parts = val.split(/\s+/);
      partial = parts[0];
    }

    if (!partial) {
      var allNames = Object.keys(term.commands).sort();
      if (allNames.length < 2) return;
      renderPromptLine(val);
      var cols = Math.ceil(Math.sqrt(allNames.length));
      var rows = Math.ceil(allNames.length / cols);
      var grid = '';
      for (var i = 0; i < rows; i++) {
        for (var j = 0; j < cols; j++) {
          var idx = j * rows + i;
          if (idx < allNames.length) {
            grid += padRight(allNames[idx], 14);
          }
        }
        grid += '\n';
      }
      addOutput(grid, 'comment');
      return;
    }

    var partialLower = partial.toLowerCase();
    var matches = Object.keys(term.commands).filter(function (c) {
      return c.indexOf(partialLower) === 0;
    });

    if (matches.length === 1) {
      if (pipeActive) {
        var suffix = val.substring(pipeIdx + 1);
        var typedBefore = suffix.substring(0, suffix.indexOf(partial) + partial.length);
        var afterTyped = suffix.substring(suffix.indexOf(partial) + partial.length);
        term.input.value = beforePartial + matches[0] + afterTyped + ' ';
      } else {
        var parts = val.split(/\s+/);
        var rest = parts.slice(1).join(' ');
        term.input.value = matches[0] + (rest ? ' ' + rest : ' ');
      }
    } else if (matches.length > 1) {
      renderPromptLine(val);
      var cols = Math.ceil(Math.sqrt(matches.length));
      var rows = Math.ceil(matches.length / cols);
      var grid = '';
      for (var i = 0; i < rows; i++) {
        for (var j = 0; j < cols; j++) {
          var idx = j * rows + i;
          if (idx < matches.length) {
            grid += padRight(matches[idx], 14);
          }
        }
        grid += '\n';
      }
      addOutput(grid, 'comment');
    }
  }

  /* ===== MODE SWITCHING ===== */
  function cmdExit() {
    exitToNormal();
  }

  function exitToNormal() {
    term.overlay.classList.add('hidden');
    term.returnBtn.classList.add('visible');
    term.input.blur();
    document.body.style.overflow = '';
  }

  function enterTerminalMode() {
    term.overlay.classList.remove('hidden');
    term.returnBtn.classList.remove('visible');
    document.body.style.overflow = 'hidden';
    setTimeout(function () { term.input.focus(); }, 100);
  }

  /* ===== COMMAND: help ===== */
  function cmdHelp() {
    addOutput('Available commands:', 'green bold');
    addOutput('');
    var names = Object.keys(term.commands).sort();
    var seen = {};
    names.forEach(function (n) {
      if (seen[n] || n === 'man') return;
      seen[n] = true;
      var d = term.commands[n].desc || '';
      addOutput('  ' + padRight(n, 10) + '  ' + d);
    });
    addOutput('');
    addOutput('Navigation tips:', 'cyan bold');
    addOutput('  Use ↑/↓ for history, Tab for auto-complete.');
    addOutput('  Click post titles or type cat <number> to open.');
    addOutput('  Pipe commands: random | open, latest | cat');
    addOutput('  Type \'exit\' to switch to the standard view.');
    addOutput('  Click the power button (⏻) in the title bar to exit.');
  }

  /* ===== COMMAND: ls ===== */
  function cmdLs(args) {
    if (!term.posts.length) {
      addOutput('No posts found.', 'amber');
      return;
    }
    var longFormat = args.indexOf('-l') !== -1;
    var showAll = args.indexOf('-a') !== -1;
    var page = 1;

    var pageMatch = args.match(/^(\d+)$/);
    if (pageMatch) page = parseInt(pageMatch[1], 10);

    var perPage = showAll ? term.posts.length : 10;
    var totalPages = Math.ceil(term.posts.length / perPage);
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    var start = (page - 1) * perPage;
    var end = Math.min(start + perPage, term.posts.length);
    var pagePosts = term.posts.slice(start, end);

    if (showAll) {
      addOutput('All ' + term.posts.length + ' posts:', 'green bold');
    } else {
      addOutput('Recent posts (page ' + page + '/' + totalPages + ', ' + term.posts.length + ' total):', 'green bold');
    }
    addOutput('');

    pagePosts.forEach(function (p, i) {
      var globalIdx = start + i + 1;
      if (longFormat) {
        var tagsStr = (p.tags && p.tags.length) ? ' [' + p.tags.join(', ') + ']' : '';
        addOutputRaw(
          '  <span class="terminal-post-idx">' + globalIdx + '.</span>'
          + '<a class="terminal-post-title" data-idx="' + globalIdx + '">' + escHtml(p.title) + '</a>'
          + '<span class="terminal-post-date">' + (p.date || '') + '</span>'
          + '<span class="terminal-post-tags">' + tagsStr + '</span>'
        );
      } else {
        addOutputRaw(
          '  <span class="terminal-post-idx">' + padRight(String(globalIdx), 3) + '</span>'
          + '<a class="terminal-post-title" data-idx="' + globalIdx + '">' + escHtml(p.title) + '</a>'
          + '<span class="terminal-post-date">' + (p.date || '') + '</span>'
        );
      }
    });

    addOutput('');
    var hint = 'Use cat <number> to read a post, or ls <n> for more.';
    if (!showAll && term.posts.length > perPage) {
      hint += ' Use ls -a to show all.';
    }
    addOutput(hint, 'dim');

    // Bind click handlers for post titles
    setTimeout(bindPostClicks, 50);
  }

  function bindPostClicks() {
    var links = term.screen.querySelectorAll('.terminal-post-title[data-idx]');
    for (var i = 0; i < links.length; i++) {
      links[i].addEventListener('click', function (e) {
        e.preventDefault();
        var idx = parseInt(this.getAttribute('data-idx'), 10);
        openPostByIdx(idx);
      });
    }
  }

  /* ===== COMMAND: cat / open ===== */
  function cmdCat(args) {
    if (!args) {
      addOutput('Usage: cat <number> or cat <post title keywords>', 'amber');
      addOutput('  e.g. cat 1       — open post #1 from ls output', 'dim');
      addOutput('  e.g. cat vault   — open first post matching "vault"', 'dim');
      return;
    }

    var numMatch = args.match(/^(\d+)$/);
    if (numMatch) {
      var idx = parseInt(numMatch[1], 10);
      openPostByIdx(idx);
      return;
    }

    var query = args.toLowerCase();
    for (var i = 0; i < term.posts.length; i++) {
      if (term.posts[i].title.toLowerCase().indexOf(query) !== -1) {
        openPost(term.posts[i]);
        return;
      }
    }
    addOutput('No post found matching "' + args + '". Try ls to see available posts.', 'amber');
  }

  function openPostByIdx(idx) {
    var p = term.posts[idx - 1];
    if (p) {
      openPost(p);
    } else {
      addOutput('Post #' + idx + ' not found. Use ls to list posts.', 'red');
    }
  }

  function openPost(post) {
    addOutput('Opening "' + post.title + '" in new tab...', 'green');
    if (post.url) {
      var a = document.createElement('a');
      a.href = post.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }

  /* ===== COMMAND: random ===== */
  function cmdRandom() {
    if (!term.posts.length) {
      addOutput('No posts available.', 'amber');
      return;
    }
    var idx = Math.floor(Math.random() * term.posts.length);
    var p = term.posts[idx];
    if (term.pipeActive) {
      term.pipeBuffer = idx + 1;
      addOutput('Picked #' + (idx + 1) + ': "' + p.title + '"', 'green');
    } else {
      addOutputRaw(
        '  <span class="terminal-post-idx">' + padRight(String(idx + 1), 3) + '</span>'
        + '<a class="terminal-post-title" data-idx="' + (idx + 1) + '">' + escHtml(p.title) + '</a>'
        + '<span class="terminal-post-date">' + (p.date || '') + '</span>',
        'green bold'
      );
      addOutput('Use cat ' + (idx + 1) + ' to open, or pipe to open (see help).', 'dim');
      setTimeout(bindPostClicks, 50);
    }
  }

  /* ===== COMMAND: latest ===== */
  function cmdLatest() {
    if (!term.posts.length) {
      addOutput('No posts available.', 'amber');
      return;
    }
    var p = term.posts[0];
    if (term.pipeActive) {
      term.pipeBuffer = 1;
      addOutput('Picked #1: "' + p.title + '"', 'green');
    } else {
      addOutputRaw(
        '  <span class="terminal-post-idx">' + padRight('1', 3) + '</span>'
        + '<a class="terminal-post-title" data-idx="1">' + escHtml(p.title) + '</a>'
        + '<span class="terminal-post-date">' + (p.date || '') + '</span>',
        'green bold'
      );
      addOutput('Use cat 1 to open, or pipe to open (see help).', 'dim');
      setTimeout(bindPostClicks, 50);
    }
  }

  /* ===== COMMAND: search ===== */
  function cmdSearch(args) {
    if (!args) {
      addOutput('Usage: search <query>', 'amber');
      addOutput('  e.g. search kubernetes', 'dim');
      return;
    }
    var q = args.toLowerCase();
    var results = [];
    for (var i = 0; i < term.posts.length; i++) {
      var p = term.posts[i];
      if (p.title.toLowerCase().indexOf(q) !== -1
        || (p.tags && p.tags.join(' ').toLowerCase().indexOf(q) !== -1)) {
        results.push(p);
      }
    }
    if (!results.length) {
      addOutput('No results for "' + args + '".', 'amber');
      return;
    }
    addOutput('Found ' + results.length + ' result(s) for "' + args + '":', 'green bold');
    addOutput('');
    results.forEach(function (p) {
      var globalIdx = term.posts.indexOf(p) + 1;
      addOutputRaw(
        '  <span class="terminal-post-idx">' + padRight(String(globalIdx), 3) + '</span>'
        + '<a class="terminal-post-title" data-idx="' + globalIdx + '">' + escHtml(p.title) + '</a>'
        + '<span class="terminal-post-date">' + (p.date || '') + '</span>'
      );
    });
    addOutput('');
    addOutput('Use cat <number> to read a post, or click above.', 'dim');
    setTimeout(bindPostClicks, 50);
  }

  /* ===== COMMAND: tags ===== */
  function cmdTags() {
    if (!term.tags.length) {
      addOutput('No tags found.', 'amber');
      return;
    }
    addOutput('Tags (' + term.tags.length + ' total):', 'green bold');
    addOutput('');
    var html = '<div class="terminal-line terminal-tag-list">';
    term.tags.forEach(function (t) {
      var count = 0;
      for (var i = 0; i < term.posts.length; i++) {
        if (term.posts[i].tags && term.posts[i].tags.indexOf(t) !== -1) count++;
      }
      html += '<span class="terminal-tag-entry" data-tag="' + escHtml(t) + '">'
        + escHtml(t) + ' <span class="terminal-tag-count">(' + count + ')</span>'
        + '</span>';
    });
    html += '</div>';
    addOutputRaw(html);
    addOutput('');
    addOutput('Type tag <name> to see posts for a specific tag, or click a tag above.', 'dim');
    setTimeout(function () {
      var entries = term.screen.querySelectorAll('.terminal-tag-entry[data-tag]');
      for (var j = 0; j < entries.length; j++) {
        entries[j].addEventListener('click', function () {
          processCommand('tag ' + this.getAttribute('data-tag'));
        });
      }
    }, 50);
  }

  /* ===== COMMAND: tag ===== */
  function cmdTag(args) {
    if (!args) {
      addOutput('Usage: tag <tagname>', 'amber');
      addOutput('  e.g. tag kubernetes', 'dim');
      addOutput('  Use tags to list all available tags.', 'dim');
      return;
    }
    var q = args.toLowerCase();
    var matching = [];
    for (var i = 0; i < term.posts.length; i++) {
      var p = term.posts[i];
      if (p.tags) {
        for (var j = 0; j < p.tags.length; j++) {
          if (p.tags[j].toLowerCase().indexOf(q) !== -1) {
            matching.push(p);
            break;
          }
        }
      }
    }
    if (!matching.length) {
      addOutput('No posts found with tag "' + args + '".', 'amber');
      return;
    }
    addOutput('Posts tagged "' + args + '" (' + matching.length + '):', 'green bold');
    addOutput('');
    matching.forEach(function (p) {
      var globalIdx = term.posts.indexOf(p) + 1;
      addOutputRaw(
        '  <span class="terminal-post-idx">' + padRight(String(globalIdx), 3) + '</span>'
        + '<a class="terminal-post-title" data-idx="' + globalIdx + '">'
        + escHtml(p.title) + '</a>'
        + '<span class="terminal-post-date">' + (p.date || '') + '</span>'
      );
    });
    addOutput('');
    addOutput('Use cat <number> to open a post, or click above.', 'dim');
    setTimeout(bindPostClicks, 50);
  }

  /* ===== COMMAND: about ===== */
  function cmdAbout() {
    addOutput('About', 'green bold');
    addOutput('');
    addOutput('Infrastructure & Platform Engineer. I write about Kubernetes,');
    addOutput('cloud-native technologies, networking, and infrastructure automation.');
    addOutput('');
    addOutput('This site is a collection of notes, guides, and hard-won lessons');
    addOutput('from running production systems.');
    addOutput('');
    addOutput('  ' + term.posts.length + ' posts published', 'cyan');
    addOutput('  ' + term.tags.length + ' unique tags', 'cyan');
  }

  /* ===== COMMAND: skills ===== */
  function cmdSkills() {
    addOutput('Skills & Technologies', 'green bold');
    addOutput('');
    SKILLS.forEach(function (s) {
      addOutput('  ' + padRight(s.key, 18) + s.value);
    });
  }

  /* ===== COMMAND: whoami ===== */
  function cmdWhoami() {
    addOutput('');
    addOutput('  Login:    magichuihui');
    addOutput('  Name:     Kyra');
    addOutput('  Site:     ' + (term.site.url || 'blog.amyinfo.com'));
    addOutput('  Posts:    ' + term.posts.length);
    addOutput('  Tags:     ' + term.tags.length);
    addOutput('  Uptime:   varies');
    addOutput('');
  }

  /* ===== COMMAND: neofetch ===== */
  function cmdNeofetch() {
    addOutput('');
    addOutput('          .-\'`' + padRight('`' + '\'-.', 30), 'amber');
    addOutput('        .\'  KyraOS v1.0.0  `.', 'amber');
    addOutput('       /      ' + term.site.title + '      \\', 'amber');
    addOutput('      ;    ' + (term.site.url || '') + '    ;', 'amber');
    addOutput('      |     ' + term.posts.length + ' posts loaded     |', 'amber');
    addOutput('      ;                      ;', 'amber');
    addOutput('       \\                    /', 'amber');
    addOutput('        `.                .\'', 'amber');
    addOutput('          `-...----...-\'', 'amber');
    addOutput('');
    addOutputRaw(
      '  <span style="color:var(--terminal-cyan)">' + padRight('Host', 16) + '</span><span style="color:var(--terminal-text)">' + (term.site.title || 'Kyra\'s home') + '</span>');
    addOutputRaw(
      '  <span style="color:var(--terminal-cyan)">' + padRight('Kernel', 16) + '</span><span style="color:var(--terminal-text)">KyraOS v1.0.0</span>');
    addOutputRaw(
      '  <span style="color:var(--terminal-cyan)">' + padRight('Posts', 16) + '</span><span style="color:var(--terminal-text)">' + term.posts.length + ' articles</span>');
    addOutputRaw(
      '  <span style="color:var(--terminal-cyan)">' + padRight('Tags', 16) + '</span><span style="color:var(--terminal-text)">' + term.tags.length + ' unique</span>');
    addOutputRaw(
      '  <span style="color:var(--terminal-cyan)">' + padRight('Uptime', 16) + '</span><span style="color:var(--terminal-text)">long enough</span>');
    addOutput('');
  }

  /* ===== COMMAND: contact / social ===== */
  function cmdContact() {
    addOutput('Contact', 'green bold');
    addOutput('');
    addOutput('  GitHub    github.com/magichuihui');
    addOutput('  Blog      ' + (term.site.url || 'blog.amyinfo.com'));
    addOutput('');
    addOutput('Active in Kubernetes communities and the Fediverse.', 'dim');
  }

  function cmdSocial() {
    addOutput('Social Links', 'green bold');
    addOutput('');
    addOutput('  GitHub    github.com/magichuihui');
    addOutput('  Twitter   @magichuihui');
    addOutput('  Blog      ' + (term.site.url || 'blog.amyinfo.com'));
    addOutput('');
    addOutput('  RSS Feed  ' + (term.site.url || '/') + 'feed.xml', 'dim');
  }

  /* ===== COMMAND: github ===== */
  function cmdGithub() {
    addOutput('Opening GitHub profile...', 'green');
    addOutput('https://github.com/magichuihui', 'blue');
    openUrlNewTab('https://github.com/magichuihui');
  }

  /* ===== COMMAND: repo ===== */
  function cmdRepo() {
    addOutput('Opening source code...', 'green');
    addOutput('https://github.com/magichuihui/magichuihui.github.io', 'blue');
    openUrlNewTab('https://github.com/magichuihui/magichuihui.github.io');
  }

  /* ===== COMMAND: clear ===== */
  function cmdClear() {
    term.screen.innerHTML = '';
    term.input.value = '';
    term.input.focus();
  }

  /* ===== COMMAND: date ===== */
  function cmdDate() {
    addOutput(new Date().toString(), 'green');
  }

  /* ===== COMMAND: uptime ===== */
  function cmdUptime() {
    addOutput(' ' + UPTIME_JOKES[Math.floor(Math.random() * UPTIME_JOKES.length)], 'amber');
  }

  /* ===== COMMAND: history ===== */
  function cmdHistory() {
    if (!term.history.length) {
      addOutput('No commands in history.', 'dim');
      return;
    }
    addOutput('');
    term.history.forEach(function (c, i) {
      addOutput('  ' + (i + 1) + '  ' + c);
    });
    addOutput('');
  }

  /* ===== COMMAND: echo ===== */
  function cmdEcho(args) {
    if (args) addOutput(args, 'green');
  }

  /* ===== COMMAND: uname ===== */
  function cmdUname() {
    addOutput('KyraOS kyra-blog 6.8.0-kyra #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux', 'green');
  }

  /* ===== COMMAND: banner ===== */
  function cmdBanner() {
    ASCII_BANNER.forEach(function (l) {
      if (l) {
        var el = document.createElement('div');
        el.className = 'terminal-line terminal-ascii';
        el.textContent = l;
        term.screen.appendChild(el);
      } else {
        addOutput('');
      }
    });
    addOutput('Welcome back!', 'green');
  }

  /* ===== UTILITIES ===== */
  function openUrlNewTab(url) {
    var a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function escapeHtml(str) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(str));
    return d.innerHTML;
  }
  var escHtml = escapeHtml;

  function padRight(str, len) {
    str = String(str);
    while (str.length < len) str += ' ';
    return str;
  }

  /* ===== GAME: SPACE SHOOTER ===== */
  function cmdPlay() {
    if (term.gameActive) {
      addOutput('Game already running.', 'amber');
      return;
    }
    if (!term.posts.length) {
      addOutput('No posts loaded.', 'amber');
      return;
    }
    term.gameActive = true;
    var savedHTML = term.screen.innerHTML;
    var inputLine = document.getElementById('terminal-input-line');
    var savedInputDisplay = inputLine.style.display;
    inputLine.style.display = 'none';
    term.input.disabled = true;

    var W = 44, H = 18;
    var g = {
      px: 20, py: H - 2,
      bullets: [],
      enemies: [],
      enemyBullets: [],
      hp: 5,
      invincible: 0,
      score: 0,
      frame: 0,
      keys: {},
      running: true,
      spawnRate: 40
    };

    function render() {
      var grid = [];
      for (var y = 0; y < H; y++) {
        grid[y] = new Array(W);
        for (var x = 0; x < W; x++) grid[y][x] = ' ';
      }

      // Player: /^\ 
      grid[g.py][g.px] = '^';
      if (g.px - 1 >= 0) grid[g.py + 1][g.px - 1] = '/';
      if (g.px + 1 < W) grid[g.py + 1][g.px + 1] = '\\';

      for (var i = 0; i < g.bullets.length; i++) {
        var b = g.bullets[i];
        if (b.y >= 0) grid[b.y][b.x] = '|';
      }

      for (var i = 0; i < g.enemies.length; i++) {
        var e = g.enemies[i];
        if (e.y >= 0) grid[e.y][e.x] = '*';
      }

      for (var i = 0; i < g.enemyBullets.length; i++) {
        var eb = g.enemyBullets[i];
        if (eb.y >= 0 && eb.y < H) grid[eb.y][eb.x] = 'v';
      }

      var dashes = new Array(45).join('─');
      var out = '<pre style="color:var(--terminal-green);line-height:1.1;font-size:0.72rem;font-family:monospace;margin:0">';
      out += '<span style="color:var(--terminal-amber)">┌' + dashes + '┐</span>\n';
      var hpStr = '';
      for (var i = 0; i < 5; i++) hpStr += i < g.hp ? '♥' : '·';
      var scoreLine = '  HP: ' + hpStr + '  SCORE: ' + padRight(String(g.score), 5) + '  WAVE: ' + padRight(String(Math.floor(g.frame / 300) + 1), 3);
      while (scoreLine.length < 44) scoreLine += ' ';
      out += '<span style="color:var(--terminal-amber)">│</span>' + scoreLine + '<span style="color:var(--terminal-amber)">│</span>\n';
      out += '<span style="color:var(--terminal-amber)">├' + dashes + '┤</span>\n';
      for (var y = 0; y < H; y++) {
        out += '<span style="color:var(--terminal-amber)">│</span>' + grid[y].join('') + '<span style="color:var(--terminal-amber)">│</span>\n';
      }
      out += '<span style="color:var(--terminal-amber)">└' + dashes + '┘</span>\n';
      out += '<span style="color:var(--terminal-comment)"> [←][→] move  [space] shoot  [q] quit</span>';
      out += '</pre>';
      term.screen.innerHTML = out;
      scrollBottom();
    }

    function update() {
      if (g.keys['ArrowLeft'] || g.keys['a']) g.px = Math.max(1, g.px - 2);
      if (g.keys['ArrowRight'] || g.keys['d']) g.px = Math.min(W - 2, g.px + 2);

      if ((g.keys[' '] || g.keys['j']) && g.frame % 4 === 0) {
        g.bullets.push({ x: g.px, y: g.py - 1 });
      }

      if (g.frame % g.spawnRate === 0) {
        for (var i = 0; i < 2; i++) {
          if (g.enemies.length < 12) {
            g.enemies.push({ x: 1 + Math.floor(Math.random() * (W - 2)), y: 1 });
          }
        }
        g.spawnRate = Math.max(18, 40 - Math.floor(g.frame / 150) * 3);
      }

      if (g.frame % 3 === 0 && g.enemyBullets.length < 15) {
        for (var i = 0; i < g.enemies.length; i++) {
          if (Math.random() < 0.05) {
            g.enemyBullets.push({ x: g.enemies[i].x, y: g.enemies[i].y + 1 });
          }
        }
      }

      for (var i = g.bullets.length - 1; i >= 0; i--) {
        g.bullets[i].y--;
        if (g.bullets[i].y < 0) { g.bullets.splice(i, 1); continue; }
      }

      if (g.frame % 3 === 0) {
        for (var i = g.enemies.length - 1; i >= 0; i--) {
          g.enemies[i].y++;
          if (g.enemies[i].y >= H) { g.enemies.splice(i, 1); continue; }
        }
      }

      for (var i = g.enemyBullets.length - 1; i >= 0; i--) {
        g.enemyBullets[i].y++;
        if (g.enemyBullets[i].y >= H) { g.enemyBullets.splice(i, 1); }
      }

      for (var i = g.bullets.length - 1; i >= 0; i--) {
        var hit = false;
        for (var j = g.enemies.length - 1; j >= 0; j--) {
          if (Math.abs(g.bullets[i].x - g.enemies[j].x) <= 1 && Math.abs(g.bullets[i].y - g.enemies[j].y) <= 1) {
            g.bullets.splice(i, 1);
            g.enemies.splice(j, 1);
            g.score += 10;
            hit = true;
            break;
          }
        }
        if (hit) continue;
      }

      if (g.invincible <= 0) {
        for (var i = g.enemyBullets.length - 1; i >= 0; i--) {
          var eb = g.enemyBullets[i];
          if (Math.abs(eb.x - g.px) <= 1 && eb.y >= g.py) {
            g.enemyBullets.splice(i, 1);
            g.hp--;
            g.invincible = 15;
            if (g.hp <= 0) return false;
            break;
          }
        }
      }

      for (var i = g.enemies.length - 1; i >= 0; i--) {
        var e = g.enemies[i];
        if (Math.abs(e.x - g.px) <= 1 && e.y >= g.py) {
          g.enemies.splice(i, 1);
          if (g.invincible <= 0) {
            g.hp--;
            g.invincible = 15;
            if (g.hp <= 0) return false;
          }
        }
      }

      if (g.invincible > 0) g.invincible--;

      g.frame++;
      return true;
    }

    function gameOver() {
      g.running = false;
      var out = '<pre style="color:var(--terminal-amber);line-height:1.8;font-size:0.85rem;text-align:center;font-family:monospace">';
      out += '\n\n';
      out += '   ██████   █████  ███    ███ ███████     ██████  ██    ██ ███████ ██████  \n';
      out += '  ██       ██   ██ ████  ████ ██         ██    ██ ██    ██ ██      ██   ██ \n';
      out += '  ██   ███ ███████ ██ ████ ██ █████      ██    ██ ██    ██ █████   ██████  \n';
      out += '  ██    ██ ██   ██ ██  ██  ██ ██         ██    ██  ██  ██  ██      ██   ██ \n';
      out += '   ██████  ██   ██ ██      ██ ███████     ██████    ████   ███████ ██   ██ \n';
      out += '\n';
      out += '  <span style="color:var(--terminal-green)">Final Score: ' + g.score + '</span>\n';
      out += '  Press any key to return to terminal\n';
      out += '</pre>';
      term.screen.innerHTML = out;
      scrollBottom();
      document.addEventListener('keydown', function _waitKey() {
        document.removeEventListener('keydown', _waitKey);
        cleanup();
      });
    }

    function onKeyDown(e) {
      if (e.key === 'q' || e.key === 'Q') {
        cleanup();
        e.preventDefault();
        return;
      }
      g.keys[e.key] = true;
      if (['ArrowLeft', 'ArrowRight', ' ', 'a', 'd', 'j'].indexOf(e.key) !== -1) {
        e.preventDefault();
      }
    }

    function onKeyUp(e) {
      g.keys[e.key] = false;
    }

    function cleanup() {
      if (!term.gameActive) return;
      term.gameActive = false;
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      if (interval) { clearInterval(interval); interval = null; }

      term.screen.innerHTML = savedHTML;
      term.screen.style.overflow = '';
      inputLine.style.display = savedInputDisplay;
      term.input.disabled = false;
      addOutput('Exited game. Score: ' + g.score, 'green');
      scrollBottom();
      term.input.focus();
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    term.screen.style.overflow = 'hidden';
    render();

    var interval = setInterval(function () {
      if (!g.running) return;
      var alive = update();
      render();
      if (!alive) { gameOver(); }
    }, 80);
  }

  /* ===== BOOT ===== */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
