import { getCurrentUser, getUserProfile } from '../../utils/auth.js';
import { renderSidebar, initSidebar } from '../../components/sidebar.js';
import { renderHeader, initHeader, setBreadcrumb } from '../../components/header.js';
import { showToast } from '../../components/toast.js';
import { supabase } from '../../utils/supabase.js';
import { escapeHtml } from '../../utils/sanitize.js';
import { router } from '../../router.js';
import gsap from 'gsap';

export async function renderAdminRoomSessions() {
  const app = document.getElementById('app');
  const user = await getCurrentUser();
  if (!user) { router.navigate('/login'); return; }
  const profile = await getUserProfile(user.id);
  if (!profile || profile.role !== 'admin') { router.navigate('/dashboard'); return; }

  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar(profile)}
      <div class="main-content">
        ${renderHeader(profile)}
        <div class="page-container">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-xl);">
            <div>
              <h2 style="margin:0;"><i class="fa-solid fa-video" style="margin-right:8px;color:var(--primary);"></i>Room Sessions</h2>
              <p style="color:var(--text-secondary);font-size:0.875rem;margin-top:4px;">Meeting history & participant tracking</p>
            </div>
          </div>
          <div class="card" style="padding:0;overflow:hidden;">
            <div class="table-container">
              <table class="data-table" id="sessions-table">
                <thead>
                  <tr>
                    <th>Room</th>
                    <th>Organizer</th>
                    <th>Started</th>
                    <th>Ended</th>
                    <th>Duration</th>
                    <th>Participants</th>
                    <th>Screens</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody id="sessions-tbody">
                  <tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-muted);"><span class="spinner"></span> Loading...</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
    <!-- Session Detail Modal -->
    <div id="session-detail-modal" class="modal" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:var(--bg-overlay);z-index:9999;align-items:center;justify-content:center;">
      <div class="modal-content card" style="max-width:600px;width:90%;max-height:80vh;overflow-y:auto;position:relative;">
        <button class="btn btn-ghost" style="position:absolute;top:10px;right:10px;" onclick="document.getElementById('session-detail-modal').style.display='none'"><i class="fa-solid fa-xmark"></i></button>
        <h3 style="margin-bottom:var(--space-lg);"><i class="fa-solid fa-users"></i> Session Details</h3>
        <div id="session-detail-content"></div>
      </div>
    </div>
  `;

  initSidebar(); initHeader(profile); setBreadcrumb('Room Sessions');

  // Load sessions
  const { data: sessions } = await supabase
    .from('room_sessions')
    .select('*, idea_rooms(name), profiles!room_sessions_organizer_id_fkey(display_name)')
    .order('started_at', { ascending: false })
    .limit(100);

  const tbody = document.getElementById('sessions-tbody');
  if (!sessions || sessions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-muted);">No sessions found</td></tr>';
    return;
  }

  tbody.innerHTML = sessions.map((s, i) => {
    const start = new Date(s.started_at);
    const end = s.ended_at ? new Date(s.ended_at) : null;
    const duration = end ? formatDuration(end - start) : '<span class="badge badge-success">Active</span>';
    const participants = Array.isArray(s.participants) ? s.participants.length : 0;
    const screens = Array.isArray(s.screen_share_events) ? s.screen_share_events.length : 0;
    return `
      <tr style="animation:fadeInUp 0.3s ease ${i * 0.05}s both;">
        <td><strong>${escapeHtml(s.idea_rooms?.name || 'Unknown')}</strong></td>
        <td>${escapeHtml(s.profiles?.display_name || 'Unknown')}</td>
        <td>${start.toLocaleDateString()} ${start.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</td>
        <td>${end ? end.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '—'}</td>
        <td>${duration}</td>
        <td><span class="badge badge-primary">${participants}</span></td>
        <td><span class="badge badge-warning">${screens}</span></td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="window._viewSession('${s.id}')" title="View Details"><i class="fa-solid fa-eye"></i></button>
          <button class="btn btn-ghost btn-sm" onclick="window._downloadCSV('${s.id}')" title="Download CSV"><i class="fa-solid fa-download"></i></button>
        </td>
      </tr>
    `;
  }).join('');

  // Store sessions for detail view
  window._sessionsData = sessions;

  window._viewSession = (sessionId) => {
    const s = window._sessionsData.find(x => x.id === sessionId);
    if (!s) return;
    const content = document.getElementById('session-detail-content');
    const participants = Array.isArray(s.participants) ? s.participants : [];
    const screenEvents = Array.isArray(s.screen_share_events) ? s.screen_share_events : [];
    content.innerHTML = `
      <div style="margin-bottom:var(--space-lg);">
        <h4 style="margin-bottom:8px;">Room: ${escapeHtml(s.idea_rooms?.name || 'Unknown')}</h4>
        <p style="color:var(--text-secondary);font-size:0.85rem;">Organizer: ${escapeHtml(s.profiles?.display_name || 'Unknown')}</p>
        <p style="color:var(--text-secondary);font-size:0.85rem;">Started: ${new Date(s.started_at).toLocaleString()}</p>
        <p style="color:var(--text-secondary);font-size:0.85rem;">Ended: ${s.ended_at ? new Date(s.ended_at).toLocaleString() : 'Still active'}</p>
      </div>
      <h4 style="margin-bottom:8px;"><i class="fa-solid fa-users"></i> Participants (${participants.length})</h4>
      <div style="margin-bottom:var(--space-lg);">
        ${participants.map(p => `
          <div class="card" style="padding:10px 14px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;">
            <span><strong>${escapeHtml(p.display_name || 'Unknown')}</strong></span>
            <span style="font-size:0.75rem;color:var(--text-muted);">Joined: ${new Date(p.joined_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>
          </div>
        `).join('') || '<p style="color:var(--text-muted);">No participants recorded</p>'}
      </div>
      ${screenEvents.length > 0 ? `
        <h4 style="margin-bottom:8px;"><i class="fa-solid fa-display"></i> Screen Shares (${screenEvents.length})</h4>
        ${screenEvents.map(e => `
          <div class="card" style="padding:10px 14px;margin-bottom:6px;">
            <strong>${escapeHtml(e.display_name || 'Unknown')}</strong>
            <span style="font-size:0.75rem;color:var(--text-muted);margin-left:8px;">
              ${new Date(e.started_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} — ${e.ended_at ? new Date(e.ended_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : 'ongoing'}
            </span>
          </div>
        `).join('')}
      ` : ''}
    `;
    document.getElementById('session-detail-modal').style.display = 'flex';
  };

  window._downloadCSV = (sessionId) => {
    const s = window._sessionsData.find(x => x.id === sessionId);
    if (!s) return;
    const participants = Array.isArray(s.participants) ? s.participants : [];
    let csv = 'Name,User ID,Joined At\n';
    participants.forEach(p => {
      csv += `"${p.display_name || 'Unknown'}","${p.user_id}","${p.joined_at}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-${sessionId.slice(0,8)}-participants.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSV downloaded!', 'success');
  };

  gsap.fromTo('.page-container', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' });
}

function formatDuration(ms) {
  const mins = Math.floor(ms / 60000);
  const hrs = Math.floor(mins / 60);
  const m = mins % 60;
  if (hrs > 0) return `${hrs}h ${m}m`;
  return `${m}m`;
}
