export class Dialog {
    static show({ title, content, buttons }) {
        const dialog = document.getElementById('dialogBox');
        const dialogContent = dialog.querySelector('.dialog-content');
        
        dialogContent.innerHTML = `
            <h2 class="mb-md">${title}</h2>
            <div class="dialog-body">${content}</div>
            <div class="dialog-buttons">
                ${buttons.map(button => `
                    <button id="${button.id}" class="button ${
                        button.id === 'positiveButton' ? 'button-primary' : 
                        button.id === 'generalButton' ? 'button-secondary' :
                        button.id === 'textButton' ? 'button-text' : ''
                    }">${button.label}</button>
                `).join('')}
            </div>
        `;

        dialog.style.display = 'flex';

        void dialog.offsetWidth;
        dialog.classList.add('show');
        dialogContent.classList.add('show');

        buttons.forEach(button => {
            dialogContent.querySelector(`#${button.id}`).addEventListener('click', () => {
                this.hide(dialog, () => {
                    if (button.onClick) button.onClick();
                });
            });
        });

        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                this.hide(dialog);
            }
        });
    }

    static hide(dialog, callback) {
        const dialogContent = dialog.querySelector('.dialog-content');
        dialog.classList.remove('show');
        dialogContent.classList.remove('show');
        
        setTimeout(() => {
            dialog.style.display = 'none';
            if (callback) callback();
        }, 150);
    }
}