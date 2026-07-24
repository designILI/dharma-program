const heroVideos = [
  document.querySelector("#hero-video-a"),
  document.querySelector("#hero-video-b"),
].filter(Boolean);

const motionControl = document.querySelector(".motion-control");
const motionControlIcon = document.querySelector(".motion-control-icon");
const motionControlLabel = document.querySelector(".motion-control-label");
const crossfadeDuration = 1.4;
const maximumOpacity = 0.82;
const contemplativePlaybackRate = 0.4;
let activeIndex = 0;
let crossfadeStartedAt = null;
let motionPausedByUser = false;

function playVideo(video) {
  return video.play().catch(() => {
    // The visible motion control lets visitors resume when autoplay is suspended.
  });
}

function finishCrossfade() {
  const previousVideo = heroVideos[activeIndex];
  activeIndex = (activeIndex + 1) % heroVideos.length;
  previousVideo.pause();
  previousVideo.currentTime = 0;
  previousVideo.style.opacity = "0";
  heroVideos[activeIndex].style.opacity = String(maximumOpacity);
  crossfadeStartedAt = null;
}

function updateMotionControl() {
  if (!motionControl || heroVideos.length < 2) return;
  const isPaused = heroVideos[activeIndex].paused;
  motionControl.setAttribute(
    "aria-label",
    isPaused ? "Play background motion" : "Pause background motion",
  );
  motionControlIcon.textContent = isPaused ? "▶" : "Ⅱ";
  motionControlLabel.textContent = isPaused ? "Play motion" : "Pause motion";
}

function resumeActiveVideo() {
  if (motionPausedByUser || heroVideos.length < 2) return;
  playVideo(heroVideos[activeIndex]).then(updateMotionControl);
}

function updateVideoCrossfade(timestamp) {
  if (heroVideos.length < 2) return;

  const activeVideo = heroVideos[activeIndex];
  const nextVideo = heroVideos[(activeIndex + 1) % heroVideos.length];

  if (
    crossfadeStartedAt === null &&
    Number.isFinite(activeVideo.duration) &&
    activeVideo.duration > 0 &&
    activeVideo.duration - activeVideo.currentTime <= crossfadeDuration
  ) {
    crossfadeStartedAt = timestamp;
    nextVideo.currentTime = 0;
    nextVideo.style.opacity = "0";
    playVideo(nextVideo);
  }

  if (crossfadeStartedAt !== null) {
    const progress = Math.min(
      (timestamp - crossfadeStartedAt) / (crossfadeDuration * 1000),
      1,
    );
    const easedProgress = progress * progress * (3 - 2 * progress);
    activeVideo.style.opacity = String(maximumOpacity * (1 - easedProgress));
    nextVideo.style.opacity = String(maximumOpacity * easedProgress);

    if (progress >= 1) finishCrossfade();
  }

  updateMotionControl();
  requestAnimationFrame(updateVideoCrossfade);
}

if (heroVideos.length === 2) {
  heroVideos.forEach((video) => {
    video.playbackRate = contemplativePlaybackRate;
  });
  heroVideos[0].style.opacity = String(maximumOpacity);
  heroVideos[1].style.opacity = "0";
  playVideo(heroVideos[0]);
  requestAnimationFrame(updateVideoCrossfade);
}

if (motionControl) {
  motionControl.addEventListener("click", () => {
    const activeVideo = heroVideos[activeIndex];
    if (activeVideo.paused) {
      motionPausedByUser = false;
      playVideo(activeVideo).then(updateMotionControl);
    } else {
      motionPausedByUser = true;
      heroVideos.forEach((video) => video.pause());
      updateMotionControl();
    }
  });
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) resumeActiveVideo();
});

window.addEventListener("focus", resumeActiveVideo);
