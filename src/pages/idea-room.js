import { getCurrentUser, getUserProfile } from '../utils/auth.js';
import { renderSidebar, initSidebar } from '../components/sidebar.js';
import { renderHeader, initHeader, setBreadcrumb } from '../components/header.js';
import { showToast } from '../components/toast.js';
import { supabase } from '../utils/supabase.js';
import { escapeHtml } from '../utils/sanitize.js';
import { router } from '../router.js';
import gsap from 'gsap';

let _roomChannel = null;
let _peerConnections = {};
let _localStream = null;
let _screenStream = null;
let _screenPeerConnections = {};
let _currentSessionId = null;

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];

export async function renderIdeaRoomPage() {
  const app = document.getElementById('app');
  const user = await getCurrentUser();
  if (!user) { router.navigate('/login'); return; }
  const profile = await getUserProfile(user.id);
  if (!profile) { router.navigate('/login'); return; }

  const roomId = sessionStorage.getItem('current_room_id');
  if (!roomId) { router.navigate('/ideas'); return; }

  // Fetch room + members + idea info
  const { data: room } = await supabase.from('idea_rooms').select('*, project_ideas(title, description, category), profiles(display_name)').eq('id', roomId).single();
  if (!room) { showToast('Room not found', 'error'); router.navigate('/ideas'); return; }

  const isOwner = room.owner_id === user.id;
  const { data: members } = await supabase.from('room_members').select('*, profiles(display_name, email, avatar_url)').eq('room_id', roomId);
  const isMember = isOwner || members?.some(m => m.user_id === user.id);
  if (!isMember) { showToast('You are not a member of this room', 'error'); router.navigate('/ideas'); return; }

  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar(profile)}
      <div class="main-content">
        ${renderHeader(profile)}
        <div class="page-container room-page-container">
          <!-- Room Header -->
          <div class="room-topbar">
            <div class="room-topbar-left">
              <button class="btn btn-ghost btn-sm" onclick="location.hash='#/ideas'"><i class="fa-solid fa-arrow-left"></i></button>
              <div>
                <h3 style="margin:0;font-size:1rem;">${escapeHtml(room.name)}</h3>
                <span style="font-size:0.75rem;color:var(--text-muted);">${escapeHtml(room.project_ideas?.title || '')} · ${new Set([room.owner_id, ...(members||[]).map(m=>m.user_id)]).size}/${room.max_members} members</span>
              </div>
            </div>
            <div class="room-topbar-right">
              ${isOwner ? `<button class="btn btn-ghost btn-sm" id="manage-members-btn" title="Manage Members"><i class="fa-solid fa-user-gear"></i></button>` : ''}
              <button class="btn btn-ghost btn-sm" id="toggle-members-btn" title="Toggle Members"><i class="fa-solid fa-users"></i></button>
            </div>
          </div>

          <!-- Room Body -->
          <div class="room-body">
            <!-- Members Sidebar -->
            <div class="room-members-panel" id="members-panel">
              <h4 style="padding:12px 16px;margin:0;border-bottom:1px solid var(--border);font-size:0.85rem;">
                <i class="fa-solid fa-users"></i> Members (${new Set([room.owner_id, ...(members||[]).map(m=>m.user_id)]).size})
              </h4>
              <div class="room-members-list" id="members-list"></div>
              ${isOwner ? `
                <div style="padding:12px;border-top:1px solid var(--border);">
                  <button class="btn btn-primary btn-sm" style="width:100%;" id="add-member-btn"><i class="fa-solid fa-user-plus"></i> Add Member</button>
                  <button class="btn btn-secondary btn-sm" style="width:100%;margin-top:6px;" id="view-requests-btn"><i class="fa-solid fa-inbox"></i> Join Requests <span id="request-count" class="badge badge-danger" style="font-size:0.65rem;padding:2px 6px;margin-left:4px;display:none;">0</span></button>
                </div>
              ` : ''}
            </div>

            <!-- Main Content Area -->
            <div class="room-main">
              <!-- Tab Bar -->
              <div class="room-tabs">
                <button class="room-tab active" data-tab="chat"><i class="fa-solid fa-comment"></i> Chat</button>
                <button class="room-tab" data-tab="call"><i class="fa-solid fa-video"></i> Call</button>
                <button class="room-tab" data-tab="screen"><i class="fa-solid fa-display"></i> Screen Share</button>
              </div>

              <!-- Chat Tab -->
              <div class="room-tab-content active" id="tab-chat">
                <div class="room-chat-messages" id="chat-messages"></div>
                <div class="room-chat-input">
                  <input type="text" class="form-input" id="chat-input" placeholder="Type a message..." autocomplete="off" />
                  <button class="btn btn-primary" id="send-msg-btn"><i class="fa-solid fa-paper-plane"></i></button>
                </div>
              </div>

              <!-- Call Tab -->
              <div class="room-tab-content" id="tab-call">
                <div class="room-call-controls" id="call-controls">
                  <button class="btn btn-primary" id="start-call-btn"><i class="fa-solid fa-phone"></i> Start Call</button>
                  <button class="btn btn-danger" id="end-call-btn" style="display:none;"><i class="fa-solid fa-phone-slash"></i> End Call</button>
                  <button class="btn btn-secondary" id="toggle-video-btn" style="display:none;"><i class="fa-solid fa-video"></i> Video</button>
                  <button class="btn btn-secondary" id="toggle-mic-btn" style="display:none;"><i class="fa-solid fa-microphone"></i> Mic</button>
                </div>
                <div class="room-video-grid" id="video-grid"></div>
              </div>

              <!-- Screen Share Tab -->
              <div class="room-tab-content" id="tab-screen">
                <div class="room-call-controls">
                  <button class="btn btn-primary" id="start-screen-btn"><i class="fa-solid fa-display"></i> Share Screen</button>
                  <button class="btn btn-danger" id="stop-screen-btn" style="display:none;"><i class="fa-solid fa-stop"></i> Stop Sharing</button>
                  <button class="btn btn-secondary" id="screen-mic-btn" style="display:none;"><i class="fa-solid fa-microphone"></i> Mic</button>
                </div>
                <div class="room-screen-view" id="screen-view">
                  <div class="empty-state"><i class="fa-solid fa-display"></i><p>No one is sharing their screen</p></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Member Modal -->
    <div id="add-member-modal" class="modal" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:var(--bg-overlay);z-index:9999;align-items:center;justify-content:center;">
      <div class="modal-content card" style="max-width:450px;width:90%;position:relative;">
        <button class="btn btn-ghost" style="position:absolute;top:10px;right:10px;" onclick="document.getElementById('add-member-modal').style.display='none'"><i class="fa-solid fa-xmark"></i></button>
        <h3 style="margin-bottom:var(--space-lg);">Add Member by Email</h3>
        <input type="email" class="form-input" id="member-email-input" placeholder="Enter NUST email..." />
        <button class="btn btn-primary" style="margin-top:12px;width:100%;" id="confirm-add-member"><i class="fa-solid fa-user-plus"></i> Add</button>
      </div>
    </div>

    <!-- Join Requests Modal -->
    <div id="requests-modal" class="modal" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:var(--bg-overlay);z-index:9999;align-items:center;justify-content:center;">
      <div class="modal-content card" style="max-width:500px;width:90%;max-height:80vh;overflow-y:auto;position:relative;">
        <button class="btn btn-ghost" style="position:absolute;top:10px;right:10px;" onclick="document.getElementById('requests-modal').style.display='none'"><i class="fa-solid fa-xmark"></i></button>
        <h3 style="margin-bottom:var(--space-lg);">Join Requests</h3>
        <div id="requests-list"></div>
      </div>
    </div>
  `;

  initSidebar(); initHeader(profile); setBreadcrumb('Idea Room');

  // Build peer name lookup from members list (include self)
  const _peerNames = {};
  _peerNames[room.owner_id] = room.profiles?.display_name || 'Owner';
  (members || []).forEach(m => { _peerNames[m.user_id] = m.profiles?.display_name || 'Member'; });
  _peerNames[user.id] = profile.display_name || 'You';

  // ── Render Members ──
  function renderMembers() {
    const list = document.getElementById('members-list');
    if (!list) return;
    const ownerEntry = `<div class="room-member-item"><div class="room-member-avatar">${(room.profiles?.display_name || 'O')[0].toUpperCase()}</div><div><span class="room-member-name">${escapeHtml(room.profiles?.display_name || 'Owner')}</span><span class="badge badge-primary" style="font-size:0.6rem;padding:1px 6px;margin-left:4px;">Owner</span></div></div>`;
    const memberEntries = (members || []).filter(m => m.user_id !== room.owner_id).map(m => `
      <div class="room-member-item">
        <div class="room-member-avatar">${(m.profiles?.display_name || '?')[0].toUpperCase()}</div>
        <div style="flex:1;"><span class="room-member-name">${escapeHtml(m.profiles?.display_name || 'Member')}</span></div>
        ${isOwner ? `<button class="btn btn-ghost btn-sm" style="color:var(--danger);padding:4px;" onclick="window._removeMember('${m.user_id}')" title="Remove"><i class="fa-solid fa-user-minus"></i></button>` : ''}
      </div>
    `).join('');
    list.innerHTML = ownerEntry + memberEntries;
  }
  renderMembers();

  // ── Tab Switching ──
  document.querySelectorAll('.room-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.room-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.room-tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
    });
  });

  // Toggle members panel
  document.getElementById('toggle-members-btn')?.addEventListener('click', () => {
    document.getElementById('members-panel').classList.toggle('open');
  });

  // ── Chat System (Supabase Realtime) ──
  async function loadMessages() {
    const { data: msgs } = await supabase.from('room_messages').select('*, profiles(display_name)').eq('room_id', roomId).order('created_at', { ascending: true }).limit(100);
    const container = document.getElementById('chat-messages');
    if (!msgs || msgs.length === 0) {
      container.innerHTML = '<div class="empty-state" style="padding:40px;"><i class="fa-solid fa-comment-dots"></i><p>No messages yet. Say hello!</p></div>';
      return;
    }
    container.innerHTML = msgs.map(m => renderMessage(m, user.id)).join('');
    container.scrollTop = container.scrollHeight;
  }

  function renderMessage(msg, currentUserId) {
    const isMe = msg.user_id === currentUserId;
    const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (msg.type === 'system') {
      return `<div class="room-msg-system">${escapeHtml(msg.body)}</div>`;
    }
    return `
      <div class="room-msg ${isMe ? 'room-msg-me' : 'room-msg-other'}">
        ${!isMe ? `<div class="room-msg-avatar">${(msg.profiles?.display_name || '?')[0].toUpperCase()}</div>` : ''}
        <div class="room-msg-bubble">
          ${!isMe ? `<div class="room-msg-author">${escapeHtml(msg.profiles?.display_name || 'User')}</div>` : ''}
          <div class="room-msg-text">${escapeHtml(msg.body)}</div>
          <div class="room-msg-time">${time}</div>
        </div>
      </div>
    `;
  }

  async function sendMessage() {
    const input = document.getElementById('chat-input');
    const body = input.value.trim();
    if (!body) return;
    input.value = '';
    await supabase.from('room_messages').insert({ room_id: roomId, user_id: user.id, body, type: 'text' });
  }

  document.getElementById('send-msg-btn')?.addEventListener('click', sendMessage);
  document.getElementById('chat-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });

  // Subscribe to new messages via Realtime
  _roomChannel = supabase.channel(`room-${roomId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'room_messages', filter: `room_id=eq.${roomId}` }, payload => {
      const container = document.getElementById('chat-messages');
      if (!container) return;
      const emptyState = container.querySelector('.empty-state');
      if (emptyState) emptyState.remove();
      container.insertAdjacentHTML('beforeend', renderMessage(payload.new, user.id));
      container.scrollTop = container.scrollHeight;
    })
    .on('broadcast', { event: 'webrtc-signal' }, ({ payload: sig }) => {
      if (sig.target === user.id || sig.target === 'all') handleWebRTCSignal(sig);
    })
    .subscribe(async () => {
      // Announce our name to all peers so everyone knows who we are
      _roomChannel.send({ type: 'broadcast', event: 'webrtc-signal',
        payload: { type: 'announce-name', from: user.id, name: profile.display_name || 'User', target: 'all' } });
    });

  await loadMessages();

  // ── Member Management ──
  window._removeMember = async (memberId) => {
    if (!confirm('Remove this member from the room?')) return;
    await supabase.from('room_members').delete().eq('room_id', roomId).eq('user_id', memberId);
    await supabase.from('room_messages').insert({ room_id: roomId, user_id: user.id, body: 'A member was removed from the room.', type: 'system' });
    showToast('Member removed', 'success');
    setTimeout(() => location.reload(), 500);
  };

  document.getElementById('add-member-btn')?.addEventListener('click', () => {
    document.getElementById('add-member-modal').style.display = 'flex';
  });

  document.getElementById('confirm-add-member')?.addEventListener('click', async () => {
    const email = document.getElementById('member-email-input').value.trim();
    if (!email) return;
    const totalMembers = (members?.length || 0) + 1;
    if (totalMembers >= room.max_members) { showToast(`Room is full (${room.max_members} max)`, 'error'); return; }
    const { data: target } = await supabase.from('profiles').select('id, display_name').eq('email', email).single();
    if (!target) { showToast('User not found with that email', 'error'); return; }
    if (target.id === room.owner_id || members?.some(m => m.user_id === target.id)) { showToast('User is already in this room', 'warning'); return; }
    const { error } = await supabase.from('room_members').insert({ room_id: roomId, user_id: target.id, role: 'member' });
    if (error) { showToast('Failed to add: ' + error.message, 'error'); return; }
    await supabase.from('room_messages').insert({ room_id: roomId, user_id: user.id, body: `${target.display_name} was added to the room.`, type: 'system' });
    showToast(`${target.display_name} added!`, 'success');
    document.getElementById('add-member-modal').style.display = 'none';
    setTimeout(() => location.reload(), 500);
  });

  // Join requests
  async function loadRequests() {
    const { data: requests } = await supabase.from('room_join_requests').select('*, profiles(display_name, email)').eq('room_id', roomId).eq('status', 'pending');
    const badge = document.getElementById('request-count');
    if (badge) { badge.textContent = requests?.length || 0; badge.style.display = (requests?.length > 0) ? 'inline' : 'none'; }
    const list = document.getElementById('requests-list');
    if (!list) return;
    if (!requests || requests.length === 0) { list.innerHTML = '<p style="color:var(--text-muted);">No pending requests.</p>'; return; }
    list.innerHTML = requests.map(r => `
      <div class="card" style="padding:12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
        <div><strong>${escapeHtml(r.profiles?.display_name || 'User')}</strong><br><span style="font-size:0.8rem;color:var(--text-muted);">${escapeHtml(r.profiles?.email || '')}</span>${r.message ? `<br><em style="font-size:0.8rem;">"${escapeHtml(r.message)}"</em>` : ''}</div>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-primary btn-sm" onclick="window._acceptRequest('${r.id}','${r.user_id}','${escapeHtml(r.profiles?.display_name || 'User')}')"><i class="fa-solid fa-check"></i></button>
          <button class="btn btn-danger btn-sm" onclick="window._rejectRequest('${r.id}')"><i class="fa-solid fa-xmark"></i></button>
        </div>
      </div>
    `).join('');
  }

  document.getElementById('view-requests-btn')?.addEventListener('click', () => {
    document.getElementById('requests-modal').style.display = 'flex';
    loadRequests();
  });

  window._acceptRequest = async (reqId, userId, name) => {
    const totalMembers = (members?.length || 0) + 1;
    if (totalMembers >= room.max_members) { showToast('Room is full', 'error'); return; }
    await supabase.from('room_join_requests').update({ status: 'accepted' }).eq('id', reqId);
    await supabase.from('room_members').insert({ room_id: roomId, user_id: userId, role: 'member' });
    await supabase.from('room_messages').insert({ room_id: roomId, user_id: user.id, body: `${name} joined the room.`, type: 'system' });
    showToast(`${name} accepted!`, 'success');
    loadRequests();
    setTimeout(() => location.reload(), 800);
  };

  window._rejectRequest = async (reqId) => {
    await supabase.from('room_join_requests').update({ status: 'rejected' }).eq('id', reqId);
    showToast('Request rejected', 'success');
    loadRequests();
  };

  if (isOwner) loadRequests();

  // ── WebRTC Call System ──
  let _inCall = false;

  async function startCall(videoEnabled = true) {
    try {
      _localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: videoEnabled });
    } catch (e) {
      showToast('Could not access camera/mic: ' + e.message, 'error');
      return;
    }
    _inCall = true;
    document.getElementById('start-call-btn').style.display = 'none';
    document.getElementById('end-call-btn').style.display = '';
    document.getElementById('toggle-video-btn').style.display = '';
    document.getElementById('toggle-mic-btn').style.display = '';
    addVideoElement(user.id, _localStream, true);
    // Broadcast that we joined
    _roomChannel.send({ type: 'broadcast', event: 'webrtc-signal', payload: { type: 'join-call', from: user.id, target: 'all' } });
  }

  function addVideoElement(peerId, stream, isLocal = false) {
    const grid = document.getElementById('video-grid');
    if (document.getElementById(`video-${peerId}`)) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'room-video-item';
    wrapper.id = `video-${peerId}`;
    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.playsInline = true;
    if (isLocal) video.muted = true;
    wrapper.appendChild(video);
    const label = document.createElement('div');
    label.className = 'room-video-label';
    label.textContent = isLocal ? 'You' : (_peerNames[peerId] || 'Peer');
    wrapper.appendChild(label);
    grid.appendChild(wrapper);
  }

  async function createPeerConnection(peerId) {
    if (_peerConnections[peerId]) return _peerConnections[peerId];
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    _peerConnections[peerId] = pc;
    if (_localStream) _localStream.getTracks().forEach(t => pc.addTrack(t, _localStream));
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        _roomChannel.send({ type: 'broadcast', event: 'webrtc-signal', payload: { type: 'ice-candidate', candidate: e.candidate, from: user.id, target: peerId } });
      }
    };
    pc.ontrack = (e) => { addVideoElement(peerId, e.streams[0]); };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        const el = document.getElementById(`video-${peerId}`);
        if (el) el.remove();
        delete _peerConnections[peerId];
      }
    };
    return pc;
  }

  // Separate peer connection for screen sharing
  async function createScreenPeerConnection(peerId, isSender) {
    const key = `screen-${peerId}`;
    if (_screenPeerConnections[key]) return _screenPeerConnections[key];
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    _screenPeerConnections[key] = pc;
    if (isSender && _screenStream) {
      _screenStream.getTracks().forEach(t => pc.addTrack(t, _screenStream));
    }
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        _roomChannel.send({ type: 'broadcast', event: 'webrtc-signal', payload: { type: 'screen-ice', candidate: e.candidate, from: user.id, target: peerId } });
      }
    };
    pc.ontrack = (e) => {
      addScreenElement(peerId, e.streams[0]);
    };
    return pc;
  }

  function addScreenElement(peerId, stream) {
    const view = document.getElementById('screen-view');
    const existingEmpty = view.querySelector('.empty-state');
    if (existingEmpty) existingEmpty.remove();
    let wrapper = document.getElementById(`screen-${peerId}`);
    if (wrapper) { wrapper.querySelector('video').srcObject = stream; return; }
    wrapper = document.createElement('div');
    wrapper.className = 'room-screen-item';
    wrapper.id = `screen-${peerId}`;
    const vid = document.createElement('video');
    vid.srcObject = stream;
    vid.autoplay = true;
    vid.playsInline = true;
    wrapper.appendChild(vid);
    const label = document.createElement('div');
    label.className = 'room-screen-label';
    label.textContent = peerId === user.id ? 'You' : (_peerNames[peerId] || 'Peer');
    wrapper.appendChild(label);
    view.appendChild(wrapper);
  }

  async function handleWebRTCSignal(sig) {
    if (sig.type === 'join-call' && _inCall && sig.from !== user.id) {
      const pc = await createPeerConnection(sig.from);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      _roomChannel.send({ type: 'broadcast', event: 'webrtc-signal', payload: { type: 'offer', offer, from: user.id, target: sig.from } });
    } else if (sig.type === 'offer') {
      if (!_inCall) await startCall(true);
      const pc = await createPeerConnection(sig.from);
      await pc.setRemoteDescription(new RTCSessionDescription(sig.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      _roomChannel.send({ type: 'broadcast', event: 'webrtc-signal', payload: { type: 'answer', answer, from: user.id, target: sig.from } });
    } else if (sig.type === 'answer') {
      const pc = _peerConnections[sig.from];
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(sig.answer));
    } else if (sig.type === 'ice-candidate') {
      const pc = _peerConnections[sig.from];
      if (pc) await pc.addIceCandidate(new RTCIceCandidate(sig.candidate));
    } else if (sig.type === 'announce-name') {
      // Learn other peers' display names
      if (sig.from && sig.name) _peerNames[sig.from] = sig.name;
      // Update any existing video/screen labels
      const lbl = document.querySelector(`#video-${sig.from} .room-video-label`);
      if (lbl) lbl.textContent = sig.name;
    } else if (sig.type === 'screen-share' && sig.from !== user.id) {
      // Receiver: tell the sharer we are ready to receive
      await createScreenPeerConnection(sig.from, false);
      _roomChannel.send({ type: 'broadcast', event: 'webrtc-signal',
        payload: { type: 'screen-ready', from: user.id, target: sig.from } });
    } else if (sig.type === 'screen-ready' && sig.from !== user.id) {
      // Sharer: a viewer is ready — send them a screen offer
      if (!_screenStream) return;
      const pc = await createScreenPeerConnection(sig.from, true);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      _roomChannel.send({ type: 'broadcast', event: 'webrtc-signal',
        payload: { type: 'screen-offer', offer, from: user.id, target: sig.from } });
    } else if (sig.type === 'screen-offer') {
      const pc = await createScreenPeerConnection(sig.from, false);
      await pc.setRemoteDescription(new RTCSessionDescription(sig.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      _roomChannel.send({ type: 'broadcast', event: 'webrtc-signal', payload: { type: 'screen-answer', answer, from: user.id, target: sig.from } });
    } else if (sig.type === 'screen-answer') {
      const pc = _screenPeerConnections[`screen-${sig.from}`];
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(sig.answer));
    } else if (sig.type === 'screen-ice') {
      const pc = _screenPeerConnections[`screen-${sig.from}`];
      if (pc) await pc.addIceCandidate(new RTCIceCandidate(sig.candidate));
    } else if (sig.type === 'screen-stop') {
      const el = document.getElementById(`screen-${sig.from}`);
      if (el) el.remove();
      const key = `screen-${sig.from}`;
      if (_screenPeerConnections[key]) { _screenPeerConnections[key].close(); delete _screenPeerConnections[key]; }
      const view = document.getElementById('screen-view');
      if (!view.querySelector('.room-screen-item')) {
        view.innerHTML = '<div class="empty-state"><i class="fa-solid fa-display"></i><p>No one is sharing their screen</p></div>';
      }
    }
  }

  function endCall() {
    _inCall = false;
    if (_localStream) { _localStream.getTracks().forEach(t => t.stop()); _localStream = null; }
    Object.values(_peerConnections).forEach(pc => pc.close());
    _peerConnections = {};
    document.getElementById('video-grid').innerHTML = '';
    document.getElementById('start-call-btn').style.display = '';
    document.getElementById('end-call-btn').style.display = 'none';
    document.getElementById('toggle-video-btn').style.display = 'none';
    document.getElementById('toggle-mic-btn').style.display = 'none';
  }

  document.getElementById('start-call-btn')?.addEventListener('click', () => startCall(true));
  document.getElementById('end-call-btn')?.addEventListener('click', endCall);

  document.getElementById('toggle-video-btn')?.addEventListener('click', () => {
    if (!_localStream) return;
    const vt = _localStream.getVideoTracks()[0];
    if (vt) { vt.enabled = !vt.enabled; document.getElementById('toggle-video-btn').innerHTML = vt.enabled ? '<i class="fa-solid fa-video"></i> Video' : '<i class="fa-solid fa-video-slash"></i> Video Off'; }
  });

  document.getElementById('toggle-mic-btn')?.addEventListener('click', () => {
    if (!_localStream) return;
    const at = _localStream.getAudioTracks()[0];
    if (at) { at.enabled = !at.enabled; document.getElementById('toggle-mic-btn').innerHTML = at.enabled ? '<i class="fa-solid fa-microphone"></i> Mic' : '<i class="fa-solid fa-microphone-slash"></i> Muted'; }
  });

  // ── Screen Sharing ──
  document.getElementById('start-screen-btn')?.addEventListener('click', async () => {
    try {
      _screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      addScreenElement(user.id, _screenStream);
      document.getElementById('start-screen-btn').style.display = 'none';
      document.getElementById('stop-screen-btn').style.display = '';
      // Broadcast that we're sharing — viewers will respond with screen-ready
      _roomChannel.send({ type: 'broadcast', event: 'webrtc-signal', payload: { type: 'screen-share', from: user.id, target: 'all' } });
      _screenStream.getVideoTracks()[0].onended = () => stopScreenShare();
    } catch (e) {
      showToast('Screen share cancelled', 'warning');
    }
  });

  async function stopScreenShare() {
    if (_screenStream) { _screenStream.getTracks().forEach(t => t.stop()); _screenStream = null; }
    // Close screen peer connections
    Object.entries(_screenPeerConnections).forEach(([key, pc]) => {
      if (key.startsWith('screen-')) { pc.close(); }
    });
    _screenPeerConnections = {};
    const el = document.getElementById(`screen-${user.id}`);
    if (el) el.remove();
    document.getElementById('start-screen-btn').style.display = '';
    document.getElementById('stop-screen-btn').style.display = 'none';
    const view = document.getElementById('screen-view');
    if (!view.querySelector('.room-screen-item')) {
      view.innerHTML = '<div class="empty-state"><i class="fa-solid fa-display"></i><p>No one is sharing their screen</p></div>';
    }
    _roomChannel.send({ type: 'broadcast', event: 'webrtc-signal', payload: { type: 'screen-stop', from: user.id, target: 'all' } });
    // Log screen share end
    if (_currentSessionId) {
      const { data: sess } = await supabase.from('room_sessions').select('screen_share_events').eq('id', _currentSessionId).single();
      const events = sess?.screen_share_events || [];
      const last = events.findLast(e => e.user_id === user.id && !e.ended_at);
      if (last) last.ended_at = new Date().toISOString();
      await supabase.from('room_sessions').update({ screen_share_events: events }).eq('id', _currentSessionId);
    }
  }

  document.getElementById('stop-screen-btn')?.addEventListener('click', stopScreenShare);

  // Screen share mic toggle
  document.getElementById('screen-mic-btn')?.addEventListener('click', async () => {
    if (!_screenStream) return;
    let audioTrack = _screenStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      document.getElementById('screen-mic-btn').innerHTML = audioTrack.enabled
        ? '<i class="fa-solid fa-microphone"></i> Mic'
        : '<i class="fa-solid fa-microphone-slash"></i> Muted';
    }
  });

  // ── Session Tracking ──
  try {
    const participantsList = [{ user_id: user.id, display_name: _peerNames[user.id] || 'Unknown', joined_at: new Date().toISOString() }];
    const { data: session } = await supabase.from('room_sessions').insert({
      room_id: roomId,
      organizer_id: room.owner_id,
      participants: participantsList
    }).select('id').single();
    if (session) _currentSessionId = session.id;
  } catch (e) { console.warn('Session tracking init:', e); }

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (_currentSessionId) {
      navigator.sendBeacon && supabase.from('room_sessions').update({ ended_at: new Date().toISOString() }).eq('id', _currentSessionId);
    }
    if (_localStream) _localStream.getTracks().forEach(t => t.stop());
    if (_screenStream) _screenStream.getTracks().forEach(t => t.stop());
  });

  gsap.fromTo('.room-body', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' });
}
