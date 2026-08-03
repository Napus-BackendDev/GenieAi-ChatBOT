(function () {
  'use strict';

  var FRAME_PATH = '/api/webhooks/web/widget';
  var API_PATH = '/api/webhooks/web';
  var script = document.currentScript;

  function readConfig() {
    try {
      return JSON.parse(decodeURIComponent(script.dataset.config || ''));
    } catch (_) {
      return {};
    }
  }

  function startEmbed() {
    var config = readConfig();
    if (!config.token) {
      console.error('GenieAI widget: missing signed web chat token.');
      return;
    }

    var origin = new URL(script.src, window.location.href).origin;
    var frame = document.createElement('iframe');
    frame.src = origin + FRAME_PATH;
    frame.title = 'GenieAI Web Chat';
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    frame.style.cssText = [
      'position:fixed', 'right:16px', 'bottom:16px', 'width:76px', 'height:76px',
      'border:0', 'background:transparent', 'z-index:2147483647',
      'transition:width .2s ease,height .2s ease'
    ].join(';');

    window.addEventListener('message', function (event) {
      if (event.origin !== origin || event.source !== frame.contentWindow) return;
      if (event.data && event.data.type === 'genieai:resize') {
        frame.style.width = event.data.open ? 'min(390px, calc(100vw - 24px))' : '76px';
        frame.style.height = event.data.open ? 'min(620px, calc(100vh - 24px))' : '76px';
      }
    });
    frame.addEventListener('load', function () {
      frame.contentWindow.postMessage({ type: 'genieai:init', config: config }, origin);
    });
    document.body.appendChild(frame);
  }

  function startFrame() {
    window.addEventListener('message', function init(event) {
      if (event.source !== parent || !event.data || event.data.type !== 'genieai:init' || !event.data.config?.token) return;
      window.removeEventListener('message', init);
      buildChat(event.data.config, event.origin);
    });
  }

  function buildChat(config, parentOrigin) {
    var color = config.themeColor || '#2B6CB0';
    if (!CSS.supports('color', color)) color = '#2B6CB0';

    var style = document.createElement('style');
    style.textContent = [
      '*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;font-family:Arial,sans-serif}',
      'body{background:transparent}.gw-root{width:100%;height:100%;display:flex;align-items:flex-end;justify-content:flex-end;padding:4px}',
      '.gw-toggle{width:60px;height:60px;border:0;border-radius:50%;background:' + color + ';color:white;font-size:25px;cursor:pointer;box-shadow:0 12px 30px rgba(15,23,42,.3)}',
      '.gw-panel{display:none;width:100%;height:100%;overflow:hidden;border:1px solid rgba(148,163,184,.25);border-radius:20px;background:#fff;box-shadow:0 18px 55px rgba(15,23,42,.3)}',
      '.gw-root.open .gw-toggle{display:none}.gw-root.open .gw-panel{display:flex;flex-direction:column}',
      '.gw-head{height:64px;padding:14px 16px;background:' + color + ';color:#fff;display:flex;align-items:center;justify-content:space-between}',
      '.gw-title{font-size:15px;font-weight:700}.gw-close{border:0;background:transparent;color:#fff;font-size:26px;cursor:pointer}',
      '.gw-messages{flex:1;overflow:auto;padding:14px;background:#f8fafc;display:flex;flex-direction:column;gap:10px}',
      '.gw-bubble{max-width:84%;padding:10px 12px;border-radius:15px;font-size:14px;line-height:1.45;white-space:pre-wrap;word-break:break-word}',
      '.gw-bot{align-self:flex-start;background:#fff;color:#1e293b;border:1px solid #e2e8f0}.gw-user{align-self:flex-end;background:' + color + ';color:#fff}',
      '.gw-form{display:flex;gap:8px;padding:12px;border-top:1px solid #e2e8f0;background:#fff}',
      '.gw-input{min-width:0;flex:1;border:1px solid #cbd5e1;border-radius:12px;padding:10px 12px;font-size:14px;outline:none}',
      '.gw-input:focus{border-color:' + color + '}.gw-send{border:0;border-radius:12px;padding:0 15px;background:' + color + ';color:#fff;font-weight:700;cursor:pointer}',
      '.gw-send:disabled,.gw-input:disabled{opacity:.6}'
    ].join('');
    document.head.appendChild(style);

    var root = document.createElement('div');
    root.className = 'gw-root';
    root.innerHTML = '<button class="gw-toggle" aria-label="Open chat">💬</button>' +
      '<section class="gw-panel" aria-label="GenieAI chat">' +
      '<header class="gw-head"><span class="gw-title">GenieAI Assistant</span><button class="gw-close" aria-label="Close chat">×</button></header>' +
      '<div class="gw-messages" aria-live="polite"></div>' +
      '<form class="gw-form"><input class="gw-input" maxlength="4000" autocomplete="off" placeholder="Type a message…">' +
      '<button class="gw-send" type="submit">Send</button></form></section>';
    document.body.appendChild(root);

    var messages = root.querySelector('.gw-messages');
    var form = root.querySelector('.gw-form');
    var input = root.querySelector('.gw-input');
    var send = root.querySelector('.gw-send');
    var sessionKey = 'genieai_webchat_session';
    var sessionId = sessionStorage.getItem(sessionKey);
    if (!sessionId) {
      sessionId = window.crypto?.randomUUID?.() || ('web_' + Date.now() + '_' + Math.random().toString(36).slice(2));
      sessionStorage.setItem(sessionKey, sessionId);
    }

    function bubble(text, kind) {
      var item = document.createElement('div');
      item.className = 'gw-bubble gw-' + kind;
      item.textContent = text;
      messages.appendChild(item);
      messages.scrollTop = messages.scrollHeight;
      return item;
    }

    bubble(config.welcomeMessage || 'Hello! How can I help you today?', 'bot');
    root.querySelector('.gw-toggle').addEventListener('click', function () {
      root.classList.add('open');
      parent.postMessage({ type: 'genieai:resize', open: true }, parentOrigin);
      input.focus();
    });
    root.querySelector('.gw-close').addEventListener('click', function () {
      root.classList.remove('open');
      parent.postMessage({ type: 'genieai:resize', open: false }, parentOrigin);
    });

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      var message = input.value.trim();
      if (!message) return;
      bubble(message, 'user');
      input.value = '';
      input.disabled = send.disabled = true;
      var pending = bubble('…', 'bot');
      var controller = new AbortController();
      var timeout = setTimeout(function () { controller.abort(); }, 45000);
      try {
        var response = await fetch(API_PATH, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: config.token, session_id: sessionId, message: message }),
          signal: controller.signal
        });
        var data = await response.json().catch(function () { return {}; });
        if (!response.ok) throw new Error(data.detail || 'Unable to send message.');
        pending.remove();
        (data.bubbles || []).forEach(function (text) { bubble(text, 'bot'); });
        if (!data.bubbles?.length && data.requires_human) {
          bubble('A team member will reply shortly.', 'bot');
        }
      } catch (error) {
        pending.textContent = error.name === 'AbortError'
          ? 'The request timed out. Please try again.'
          : (error.message || 'Unable to send message.');
      } finally {
        clearTimeout(timeout);
        input.disabled = send.disabled = false;
        input.focus();
      }
    });
  }

  if (window.self !== window.top) startFrame();
  else if (document.body) startEmbed();
  else window.addEventListener('DOMContentLoaded', startEmbed, { once: true });
})();
