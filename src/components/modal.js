/**
 * Modal component
 */
export function showModal(title, bodyHTML, footerHTML = '') {
  // Remove existing
  document.querySelector('.modal-overlay')?.remove();

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="modal-close" id="modal-close-btn">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div class="modal-body">${bodyHTML}</div>
      ${footerHTML ? `<div class="modal-footer">${footerHTML}</div>` : ''}
    </div>
  `;

  document.body.appendChild(modal);

  // Close handlers
  modal.querySelector('#modal-close-btn').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  return modal;
}

export function closeModal() {
  const modal = document.querySelector('.modal-overlay');
  if (modal) {
    modal.style.animation = 'fadeOut 0.2s ease forwards';
    setTimeout(() => modal.remove(), 200);
  }
}
