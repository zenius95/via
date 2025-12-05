const { ipcRenderer } = require('electron')

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('min-btn').addEventListener('click', () => {
        ipcRenderer.send('window-minimize')
    })

    document.getElementById('max-btn').addEventListener('click', () => {
        ipcRenderer.send('window-maximize')
    })

    document.getElementById('close-btn').addEventListener('click', () => {
        ipcRenderer.send('window-close')
    })

    // Listen for window state changes
    ipcRenderer.on('window-maximized', () => {
        const icon = document.querySelector('#max-btn i')
        icon.classList.remove('ri-checkbox-blank-line')
        icon.classList.add('ri-checkbox-multiple-blank-line') // Restore icon
    })

    ipcRenderer.on('window-unmaximized', () => {
        const icon = document.querySelector('#max-btn i')
        icon.classList.remove('ri-checkbox-multiple-blank-line')
        icon.classList.add('ri-checkbox-blank-line') // Maximize icon
    })
})
