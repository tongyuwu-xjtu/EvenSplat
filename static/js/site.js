document.addEventListener('DOMContentLoaded', () => {
  const viewport = document.getElementById('comparisonViewport');

  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  document.querySelectorAll('.video-pair').forEach((pair) => {
    const master = pair.querySelector('.master');
    const follower = pair.querySelector('.follower');
    const button = pair.querySelector('.play-toggle');
    const timeline = pair.querySelector('.timeline');
    const current = pair.querySelector('.current');
    const durationLabel = pair.querySelector('.duration');
    if (!master || !follower || !button || !timeline) return;

    master.muted = true;
    follower.muted = true;
    master.playsInline = true;
    follower.playsInline = true;

    let seeking = false;
    let raf = null;

    const duration = () => {
      const values = [master.duration, follower.duration].filter(Number.isFinite);
      return values.length ? Math.min(...values) : 0;
    };

    const syncFollower = (force = false) => {
      if (!Number.isFinite(master.currentTime)) return;
      if (force || Math.abs(follower.currentTime - master.currentTime) > 0.06) {
        try { follower.currentTime = master.currentTime; } catch (_) {}
      }
    };

    const update = () => {
      const d = duration();
      if (!seeking && d > 0) timeline.value = Math.round((master.currentTime / d) * 1000);
      current.textContent = formatTime(master.currentTime);
      durationLabel.textContent = formatTime(d);
      button.textContent = master.paused ? '▶' : '❚❚';
      button.setAttribute('aria-label', master.paused ? 'Play both videos' : 'Pause both videos');
    };

    const tick = () => {
      if (!master.paused) {
        syncFollower(false);
        update();
        raf = requestAnimationFrame(tick);
      }
    };

    const playBoth = async () => {
      const d = duration();
      if (d && master.currentTime >= d - 0.04) {
        master.currentTime = 0;
        follower.currentTime = 0;
      }
      syncFollower(true);
      await Promise.allSettled([master.play(), follower.play()]);
      update();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    };

    const pauseBoth = () => {
      master.pause();
      follower.pause();
      cancelAnimationFrame(raf);
      update();
    };

    const toggle = () => master.paused ? playBoth() : pauseBoth();
    button.addEventListener('click', toggle);
    master.addEventListener('click', toggle);
    follower.addEventListener('click', toggle);

    timeline.addEventListener('input', () => {
      seeking = true;
      const d = duration();
      if (!d) return;
      const t = (Number(timeline.value) / 1000) * d;
      master.currentTime = t;
      follower.currentTime = t;
      current.textContent = formatTime(t);
    });
    timeline.addEventListener('change', () => {
      seeking = false;
      syncFollower(true);
      update();
    });

    master.addEventListener('loadedmetadata', update);
    follower.addEventListener('loadedmetadata', update);
    master.addEventListener('timeupdate', update);
    master.addEventListener('play', update);
    master.addEventListener('pause', update);
    master.addEventListener('ended', () => {
      follower.pause();
      update();
    });

    [master, follower].forEach((video) => {
      video.addEventListener('error', () => video.setAttribute('title', 'Video file not added yet'));
    });
    update();
  });

  if (!viewport) return;
  viewport.addEventListener('wheel', (e) => {
    if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    if (Math.abs(e.deltaY) > 0) {
      viewport.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  }, {passive:false});

  let down = false, startX = 0, startLeft = 0;
  viewport.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.pair-controls')) return;
    down = true;
    startX = e.clientX;
    startLeft = viewport.scrollLeft;
    viewport.setPointerCapture(e.pointerId);
  });
  viewport.addEventListener('pointermove', (e) => {
    if (!down) return;
    viewport.scrollLeft = startLeft - (e.clientX - startX);
  });
  const stop = (e) => {
    if (!down) return;
    down = false;
    try { viewport.releasePointerCapture(e.pointerId); } catch (_) {}
  };
  viewport.addEventListener('pointerup', stop);
  viewport.addEventListener('pointercancel', stop);
});