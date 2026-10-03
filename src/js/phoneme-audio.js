(() => {
    let currentAudio;

    document.addEventListener('click', (event) => {
        if (!(event.target instanceof Element)) {
            return;
        }

        const link = event.target.closest('a[data-phoneme-audio]');
        if (!link) {
            return;
        }

        event.preventDefault();
        if (!currentAudio) {
            currentAudio = new Audio();
        }

        currentAudio.pause();
        currentAudio.src = link.dataset.phonemeAudio;
        currentAudio.currentTime = 0;

        const playback = currentAudio.play();
        if (playback) {
            playback.catch((error) => {
                console.error('Could not play Wikimedia Commons phoneme audio; opening its source page.', error);
                window.location.assign(link.href);
            });
        }
    });
})();
