const REPOSITORY = 'MuyeongKim/stayup-page';
const BRANCH = 'master';
const API_ROOT = 'https://api.github.com';
const OAUTH_MESSAGE_ORIGIN = 'https://www.stayup-ai.com';
const SESSION_TOKEN_KEY = 'stayup_activity_manager_github_token';
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_IMAGE_EDGE = 1600;
const WEBP_QUALITY = 0.82;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const DATE_PATTERN = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,79}$/;
const IMAGE_PATTERN = /^\/images\/[^?#]+\.(?:jpe?g|png|webp)$/i;
const BADGE_TONES = new Set(['default', 'muted']);
const SCHEDULE_PATH = 'data/firehawks-schedules.json';

const TEAMS = Object.freeze({
  stayup: {
    label: 'Stay-Up',
    dataPath: 'data/stayup-activities.json',
  },
  firehawks: {
    label: 'FireHawks',
    dataPath: 'data/firehawks-activities.json',
  },
});

const state = {
  token: null,
  user: null,
  headSha: null,
  manifests: {
    stayup: null,
    firehawks: null,
  },
  scheduleManifest: null,
  selectedTeam: 'stayup',
  editingActivity: null,
  editorInvoker: null,
  editingSchedule: null,
  scheduleEditorInvoker: null,
  processedImage: null,
  previewObjectUrl: null,
  imageProcessVersion: 0,
  imageProcessing: false,
  busy: false,
};

const elements = {
  accountDetails: document.querySelector('#account-details'),
  accountName: document.querySelector('#account-name'),
  loginButton: document.querySelector('#login-button'),
  logoutButton: document.querySelector('#logout-button'),
  statusMessage: document.querySelector('#status-message'),
  signedOutPanel: document.querySelector('#signed-out-panel'),
  manager: document.querySelector('#manager'),
  refreshButton: document.querySelector('#refresh-button'),
  addButton: document.querySelector('#add-button'),
  teamButtons: [...document.querySelectorAll('[data-team]')],
  stayupCount: document.querySelector('#stayup-count'),
  firehawksCount: document.querySelector('#firehawks-count'),
  selectedTeamTitle: document.querySelector('#selected-team-title'),
  activitySummary: document.querySelector('#activity-summary'),
  activityList: document.querySelector('#activity-list'),
  scheduleManager: document.querySelector('#schedule-manager'),
  scheduleSummary: document.querySelector('#schedule-summary'),
  scheduleList: document.querySelector('#schedule-list'),
  addScheduleButton: document.querySelector('#add-schedule-button'),
  editorDialog: document.querySelector('#editor-dialog'),
  editorStatus: document.querySelector('#editor-status'),
  activityForm: document.querySelector('#activity-form'),
  editorFields: document.querySelector('#editor-fields'),
  editorTitle: document.querySelector('#editor-title'),
  editorTeamLabel: document.querySelector('#editor-team-label'),
  closeEditorButton: document.querySelector('#close-editor-button'),
  cancelEditorButton: document.querySelector('#cancel-editor-button'),
  saveButton: document.querySelector('#save-button'),
  activityTeam: document.querySelector('#activity-team'),
  activityId: document.querySelector('#activity-id'),
  activityDate: document.querySelector('#activity-date'),
  activityEndDate: document.querySelector('#activity-end-date'),
  activityDisplayDate: document.querySelector('#activity-display-date'),
  activityCategory: document.querySelector('#activity-category'),
  activityTitle: document.querySelector('#activity-title'),
  activityDescription: document.querySelector('#activity-description'),
  activityBadge: document.querySelector('#activity-badge'),
  activityBadgeTone: document.querySelector('#activity-badge-tone'),
  activityImage: document.querySelector('#activity-image'),
  activityImageAlt: document.querySelector('#activity-image-alt'),
  activityPublished: document.querySelector('#activity-published'),
  imagePreviewPanel: document.querySelector('#image-preview-panel'),
  imagePreview: document.querySelector('#image-preview'),
  imagePreviewDetails: document.querySelector('#image-preview-details'),
  imageHelp: document.querySelector('#image-help'),
  scheduleEditorDialog: document.querySelector('#schedule-editor-dialog'),
  scheduleEditorStatus: document.querySelector('#schedule-editor-status'),
  scheduleForm: document.querySelector('#schedule-form'),
  scheduleEditorFields: document.querySelector('#schedule-editor-fields'),
  scheduleEditorTitle: document.querySelector('#schedule-editor-title'),
  closeScheduleEditorButton: document.querySelector('#close-schedule-editor-button'),
  cancelScheduleEditorButton: document.querySelector('#cancel-schedule-editor-button'),
  saveScheduleButton: document.querySelector('#save-schedule-button'),
  scheduleId: document.querySelector('#schedule-id'),
  scheduleDate: document.querySelector('#schedule-date'),
  scheduleEndDate: document.querySelector('#schedule-end-date'),
  scheduleDisplayDate: document.querySelector('#schedule-display-date'),
  scheduleTitle: document.querySelector('#schedule-title'),
  scheduleLocation: document.querySelector('#schedule-location'),
  scheduleDivision: document.querySelector('#schedule-division'),
  scheduleDescription: document.querySelector('#schedule-description'),
  schedulePublished: document.querySelector('#schedule-published'),
};

class GitHubApiError extends Error {
  constructor(status, message, responseMessage = '') {
    super(message);
    this.name = 'GitHubApiError';
    this.status = status;
    this.responseMessage = responseMessage;
  }
}

class ContentConflictError extends Error {
  constructor(message = '다른 변경사항이 먼저 저장되었습니다.') {
    super(message);
    this.name = 'ContentConflictError';
  }
}

function createElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function setStatus(message, tone = 'info') {
  elements.statusMessage.textContent = message;
  elements.statusMessage.dataset.tone = tone;
  elements.statusMessage.setAttribute('role', tone === 'error' ? 'alert' : 'status');
  const openDialogStatus = elements.editorDialog.open
    ? elements.editorStatus
    : elements.scheduleEditorDialog.open
      ? elements.scheduleEditorStatus
      : null;
  if (openDialogStatus) {
    openDialogStatus.hidden = false;
    openDialogStatus.textContent = message;
    openDialogStatus.dataset.tone = tone;
    openDialogStatus.setAttribute('role', tone === 'error' ? 'alert' : 'status');
    if (tone === 'error') {
      window.setTimeout(() => openDialogStatus.focus(), 0);
    }
  }
}

function clearDialogStatus(statusElement) {
  statusElement.hidden = true;
  statusElement.textContent = '';
  delete statusElement.dataset.tone;
  statusElement.setAttribute('role', 'status');
}

function clearEditorStatus() {
  clearDialogStatus(elements.editorStatus);
}

function clearScheduleEditorStatus() {
  clearDialogStatus(elements.scheduleEditorStatus);
}

function friendlyError(error) {
  if (error instanceof ContentConflictError) {
    return '다른 사용자의 변경이 먼저 반영되었습니다. 새로고침한 뒤 다시 시도해 주세요.';
  }
  if (error instanceof GitHubApiError) {
    if (error.status === 401) return 'GitHub 로그인이 만료되었습니다. 다시 로그인해 주세요.';
    if (error.status === 403) {
      return 'GitHub 요청 권한이 없거나 잠시 요청 한도에 도달했습니다. 계정 권한을 확인해 주세요.';
    }
    if (error.status === 404) return 'GitHub 저장소 또는 활동 파일을 찾을 수 없습니다.';
    if (error.status === 409 || error.status === 422) {
      return '저장소가 갱신되었거나 브랜치 보호 규칙으로 저장하지 못했습니다. 새로고침 후 다시 시도해 주세요.';
    }
  }
  return error instanceof Error && error.message
    ? error.message
    : '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
}

function setBusy(isBusy) {
  state.busy = isBusy;
  elements.manager.setAttribute('aria-busy', String(isBusy));
  elements.activityList.setAttribute('aria-busy', String(isBusy));
  elements.scheduleManager.setAttribute('aria-busy', String(isBusy));
  elements.scheduleList.setAttribute('aria-busy', String(isBusy));
  elements.addButton.disabled = isBusy;
  elements.addScheduleButton.disabled = isBusy || !state.scheduleManifest;
  elements.refreshButton.disabled = isBusy;
  elements.teamButtons.forEach(button => {
    button.disabled = isBusy;
  });
  elements.activityList.querySelectorAll('button').forEach(button => {
    button.disabled = isBusy;
  });
  elements.scheduleList.querySelectorAll('button').forEach(button => {
    button.disabled = isBusy;
  });
}

function setEditorBusy(isBusy) {
  elements.editorFields.disabled = isBusy;
  elements.saveButton.disabled = isBusy;
  elements.cancelEditorButton.disabled = isBusy;
  elements.closeEditorButton.disabled = isBusy;
  elements.saveButton.textContent = isBusy ? '안전하게 저장하는 중…' : '저장하고 게시';
}

function setScheduleEditorBusy(isBusy) {
  elements.scheduleEditorFields.disabled = isBusy;
  elements.saveScheduleButton.disabled = isBusy;
  elements.cancelScheduleEditorButton.disabled = isBusy;
  elements.closeScheduleEditorButton.disabled = isBusy;
  elements.saveScheduleButton.textContent = isBusy ? '안전하게 저장하는 중…' : '저장하고 게시';
}

function readSessionToken() {
  try {
    return window.sessionStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeSessionToken(token) {
  try {
    window.sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    return true;
  } catch {
    return false;
  }
}

function removeSessionToken() {
  try {
    window.sessionStorage.removeItem(SESSION_TOKEN_KEY);
  } catch {
    // The in-memory token is cleared even when storage is unavailable.
  }
}

function resetSession() {
  if (elements.editorDialog.open) {
    setEditorBusy(false);
    closeEditor();
  }
  if (elements.scheduleEditorDialog.open) {
    setScheduleEditorBusy(false);
    closeScheduleEditor();
  }
  state.token = null;
  state.user = null;
  state.headSha = null;
  state.manifests.stayup = null;
  state.manifests.firehawks = null;
  state.scheduleManifest = null;
  removeSessionToken();
  renderAuthenticationState();
}

function renderAuthenticationState() {
  const authenticated = Boolean(state.token && state.user);
  elements.loginButton.hidden = authenticated;
  elements.logoutButton.hidden = !authenticated;
  elements.accountDetails.hidden = !authenticated;
  elements.signedOutPanel.hidden = authenticated;
  elements.manager.hidden = !authenticated;
  elements.accountName.textContent = authenticated ? `@${state.user.login}` : '';
}

async function githubRequest(path, options = {}) {
  if (!state.token) throw new GitHubApiError(401, 'GitHub 로그인이 필요합니다.');

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), options.timeout || 30_000);
  const headers = new Headers(options.headers || {});
  headers.set('Accept', options.accept || 'application/vnd.github+json');
  headers.set('Authorization', `Bearer ${state.token}`);
  headers.set('X-GitHub-Api-Version', '2022-11-28');

  let body = options.body;
  if (body !== undefined && typeof body !== 'string') {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`${API_ROOT}${path}`, {
      method: options.method || 'GET',
      headers,
      body,
      signal: controller.signal,
      cache: 'no-store',
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('GitHub 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.');
    }
    throw new Error('GitHub에 연결할 수 없습니다. 네트워크 상태를 확인해 주세요.');
  } finally {
    window.clearTimeout(timeoutId);
  }

  if (!response.ok) {
    let responseMessage = '';
    try {
      const errorBody = await response.json();
      if (typeof errorBody?.message === 'string') responseMessage = errorBody.message;
    } catch {
      // A generic status-based message is safer than exposing an unknown response body.
    }
    throw new GitHubApiError(
      response.status,
      `GitHub 요청이 실패했습니다. (${response.status})`,
      responseMessage,
    );
  }

  if (response.status === 204) return null;
  return options.responseType === 'text' ? response.text() : response.json();
}

async function verifyGitHubAccess(token) {
  state.token = token;
  try {
    const [user, repository] = await Promise.all([
      githubRequest('/user'),
      githubRequest(`/repos/${REPOSITORY}`),
    ]);
    const permissions = repository?.permissions || {};
    if (!(permissions.push || permissions.maintain || permissions.admin)) {
      throw new Error('이 GitHub 계정에는 활동을 게시할 권한이 없습니다.');
    }
    if (!user || typeof user.login !== 'string') {
      throw new Error('GitHub 사용자 정보를 확인할 수 없습니다.');
    }
    state.user = { login: user.login };
    return true;
  } catch (error) {
    state.token = null;
    state.user = null;
    throw error;
  }
}

function beginGitHubLogin() {
  if (state.busy) return;
  const authUrl = new URL('/api/auth', window.location.origin);
  authUrl.search = new URLSearchParams({
    provider: 'github',
    site_id: window.location.origin,
    scope: 'public_repo',
  }).toString();

  const popup = window.open(
    authUrl.toString(),
    'stayup-github-oauth',
    'width=960,height=700,resizable=yes,scrollbars=yes',
  );
  if (!popup) {
    setStatus('로그인 팝업이 차단되었습니다. 팝업을 허용한 뒤 다시 시도해 주세요.', 'error');
    return;
  }

  setStatus('GitHub 로그인 승인을 기다리고 있습니다.', 'info');
  elements.loginButton.disabled = true;
  let finished = false;

  const cleanup = () => {
    if (finished) return;
    finished = true;
    window.removeEventListener('message', onMessage);
    window.clearInterval(closedCheck);
    window.clearTimeout(loginTimeout);
    elements.loginButton.disabled = false;
  };

  const completeLogin = async token => {
    cleanup();
    setStatus('GitHub 계정과 저장소 권한을 확인하고 있습니다.', 'info');
    try {
      await verifyGitHubAccess(token);
      if (!writeSessionToken(token)) {
        throw new Error('브라우저 세션 저장소를 사용할 수 없습니다. 개인정보 보호 설정을 확인해 주세요.');
      }
      renderAuthenticationState();
      await loadManifests();
      setStatus(`${state.user.login} 계정으로 연결되었습니다.`, 'success');
    } catch (error) {
      resetSession();
      setStatus(friendlyError(error), 'error');
    }
  };

  const onMessage = event => {
    if (event.source !== popup || event.origin !== OAUTH_MESSAGE_ORIGIN) return;
    if (event.data === 'authorizing:github') {
      popup.postMessage('authorizing:github', OAUTH_MESSAGE_ORIGIN);
      return;
    }
    if (typeof event.data !== 'string') return;

    const successPrefix = 'authorization:github:success:';
    const errorPrefix = 'authorization:github:error:';
    if (event.data.startsWith(successPrefix)) {
      try {
        const payload = JSON.parse(event.data.slice(successPrefix.length));
        if (
          payload?.provider !== 'github' ||
          typeof payload.token !== 'string' ||
          payload.token.length < 20 ||
          payload.token.length > 512
        ) {
          throw new Error('invalid token payload');
        }
        void completeLogin(payload.token);
      } catch {
        cleanup();
        setStatus('GitHub 인증 응답이 올바르지 않습니다. 다시 로그인해 주세요.', 'error');
      }
      return;
    }

    if (event.data.startsWith(errorPrefix)) {
      cleanup();
      let message = 'GitHub 로그인을 완료하지 못했습니다.';
      try {
        const payload = JSON.parse(event.data.slice(errorPrefix.length));
        if (typeof payload?.message === 'string' && payload.message.length <= 240) {
          message = payload.message;
        }
      } catch {
        // Keep the generic message.
      }
      setStatus(message, 'error');
    }
  };

  window.addEventListener('message', onMessage);
  const closedCheck = window.setInterval(() => {
    if (!finished && popup.closed) {
      cleanup();
      setStatus('GitHub 로그인 창이 닫혔습니다.', 'warning');
    }
  }, 500);
  const loginTimeout = window.setTimeout(() => {
    if (!finished) {
      cleanup();
      try {
        popup.close();
      } catch {
        // Ignore cross-origin close failures.
      }
      setStatus('로그인 시간이 초과되었습니다. 다시 시도해 주세요.', 'warning');
    }
  }, 2 * 60 * 1000);
}

function readString(value, fieldName, maxLength, optional = false) {
  if (value === undefined || value === null || value === '') {
    if (optional) return '';
    throw new Error(`${fieldName} 항목이 비어 있습니다.`);
  }
  if (typeof value !== 'string') throw new Error(`${fieldName} 항목 형식이 올바르지 않습니다.`);
  const normalized = value.trim();
  if (!normalized && !optional) throw new Error(`${fieldName} 항목이 비어 있습니다.`);
  if (normalized.length > maxLength) throw new Error(`${fieldName} 항목이 너무 깁니다.`);
  return normalized;
}

function parseDateBoundary(value, usePeriodEnd = false) {
  const match = DATE_PATTERN.exec(value);
  if (!match) throw new Error('날짜는 YYYY, YYYY-MM 또는 YYYY-MM-DD 형식이어야 합니다.');

  const year = Number(match[1]);
  const month = match[2] ? Number(match[2]) : usePeriodEnd ? 12 : 1;
  const day = match[3]
    ? Number(match[3])
    : usePeriodEnd
      ? new Date(Date.UTC(year, month, 0)).getUTCDate()
      : 1;
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    throw new Error('유효하지 않은 날짜입니다.');
  }

  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error('유효하지 않은 날짜입니다.');
  }
  return timestamp;
}

function validateImagePath(value) {
  const image = readString(value, '사진 경로', 300);
  let decodedImage;
  try {
    decodedImage = decodeURIComponent(image);
  } catch {
    throw new Error('사진 경로가 올바르지 않습니다.');
  }
  if (
    !IMAGE_PATTERN.test(image) ||
    decodedImage.includes('\\') ||
    decodedImage.split('/').includes('..')
  ) {
    throw new Error('사진 경로가 올바르지 않습니다.');
  }
  return image;
}

function activityPreviewUrl(imagePath) {
  const safePath = validateImagePath(imagePath);
  if (!safePath.startsWith('/images/activity-uploads/')) return safePath;
  if (!state.headSha || !/^[a-f0-9]{40}$/.test(state.headSha)) {
    throw new Error('업로드 사진의 GitHub 버전을 확인할 수 없습니다.');
  }
  const encodedPath = safePath
    .replace(/^\//, '')
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');
  return `https://raw.githubusercontent.com/${REPOSITORY}/${state.headSha}/${encodedPath}`;
}

function normalizeActivity(rawActivity) {
  if (!rawActivity || typeof rawActivity !== 'object' || Array.isArray(rawActivity)) {
    throw new Error('활동 데이터 형식이 올바르지 않습니다.');
  }

  const id = readString(rawActivity.id, '고유 ID', 80);
  if (!ID_PATTERN.test(id)) throw new Error('활동 고유 ID 형식이 올바르지 않습니다.');
  const date = readString(rawActivity.date, '시작일', 10);
  parseDateBoundary(date);
  const endDate = readString(rawActivity.endDate, '종료일', 10, true);
  if (endDate) {
    parseDateBoundary(endDate, true);
    if (parseDateBoundary(endDate, true) < parseDateBoundary(date)) {
      throw new Error('종료일은 시작일보다 빠를 수 없습니다.');
    }
  }

  const imageWidth = Number(rawActivity.imageWidth);
  const imageHeight = Number(rawActivity.imageHeight);
  if (
    !Number.isInteger(imageWidth) ||
    imageWidth < 1 ||
    imageWidth > 10000 ||
    !Number.isInteger(imageHeight) ||
    imageHeight < 1 ||
    imageHeight > 10000
  ) {
    throw new Error('사진 크기 정보가 올바르지 않습니다.');
  }

  const order = rawActivity.order === undefined ? 0 : Number(rawActivity.order);
  if (!Number.isInteger(order) || order < 0 || order > 9999) {
    throw new Error('활동 순서 정보가 올바르지 않습니다.');
  }

  if (typeof rawActivity.published !== 'boolean') {
    throw new Error('활동 공개 상태가 올바르지 않습니다.');
  }

  const badgeTone = readString(rawActivity.badgeTone, '강조 스타일', 20, true) || 'default';
  if (!BADGE_TONES.has(badgeTone)) throw new Error('강조 스타일이 올바르지 않습니다.');

  const activity = {
    id,
    date,
    category: readString(rawActivity.category, '분류', 60),
    title: readString(rawActivity.title, '제목', 140),
    description: readString(rawActivity.description, '설명', 600),
    image: validateImagePath(rawActivity.image),
    imageAlt: readString(rawActivity.imageAlt, '사진 설명', 180),
    imageWidth,
    imageHeight,
    order,
    published: rawActivity.published,
  };

  const displayDate = readString(rawActivity.displayDate, '표시 날짜', 40, true);
  const badge = readString(rawActivity.badge, '강조 문구', 50, true);
  if (endDate) activity.endDate = endDate;
  if (displayDate) activity.displayDate = displayDate;
  if (badge) {
    activity.badge = badge;
    activity.badgeTone = badgeTone;
  }
  return activity;
}

function normalizeManifest(rawManifest, expectedTeam) {
  if (
    !rawManifest ||
    typeof rawManifest !== 'object' ||
    Array.isArray(rawManifest) ||
    rawManifest.team !== expectedTeam ||
    !Array.isArray(rawManifest.activities)
  ) {
    throw new Error(`${TEAMS[expectedTeam].label} 활동 파일 형식이 올바르지 않습니다.`);
  }

  const ids = new Set();
  const activities = rawManifest.activities.map(rawActivity => {
    const activity = normalizeActivity(rawActivity);
    if (ids.has(activity.id)) throw new Error(`중복된 활동 ID가 있습니다: ${activity.id}`);
    ids.add(activity.id);
    return activity;
  });
  return { team: expectedTeam, activities };
}

function normalizeSchedule(rawSchedule) {
  if (!rawSchedule || typeof rawSchedule !== 'object' || Array.isArray(rawSchedule)) {
    throw new Error('출전 일정 데이터 형식이 올바르지 않습니다.');
  }

  const id = readString(rawSchedule.id, '일정 고유 ID', 80);
  if (!ID_PATTERN.test(id)) throw new Error('일정 고유 ID 형식이 올바르지 않습니다.');
  const date = readString(rawSchedule.date, '시작일', 10);
  parseDateBoundary(date);
  const endDate = readString(rawSchedule.endDate, '종료일', 10, true);
  if (endDate) {
    parseDateBoundary(endDate, true);
    if (parseDateBoundary(endDate, true) < parseDateBoundary(date)) {
      throw new Error('일정 종료일은 시작일보다 빠를 수 없습니다.');
    }
  }

  const order = rawSchedule.order === undefined ? 0 : Number(rawSchedule.order);
  if (!Number.isInteger(order) || order < 0 || order > 9999) {
    throw new Error('일정 순서 정보가 올바르지 않습니다.');
  }
  if (typeof rawSchedule.published !== 'boolean') {
    throw new Error('일정 공개 상태가 올바르지 않습니다.');
  }

  const schedule = {
    id,
    date,
    title: readString(rawSchedule.title, '대회·행사명', 140),
    location: readString(rawSchedule.location, '장소', 120),
    order,
    published: rawSchedule.published,
  };
  const displayDate = readString(rawSchedule.displayDate, '표시 날짜', 40, true);
  const division = readString(rawSchedule.division, '출전 부문', 80, true);
  const description = readString(rawSchedule.description, '안내 문구', 600, true);
  if (endDate) schedule.endDate = endDate;
  if (displayDate) schedule.displayDate = displayDate;
  if (division) schedule.division = division;
  if (description) schedule.description = description;
  return schedule;
}

function normalizeScheduleManifest(rawManifest) {
  if (
    !rawManifest ||
    typeof rawManifest !== 'object' ||
    Array.isArray(rawManifest) ||
    rawManifest.team !== 'firehawks' ||
    !Array.isArray(rawManifest.schedules)
  ) {
    throw new Error('FireHawks 출전 일정 파일 형식이 올바르지 않습니다.');
  }

  const ids = new Set();
  const schedules = rawManifest.schedules.map(rawSchedule => {
    const schedule = normalizeSchedule(rawSchedule);
    if (ids.has(schedule.id)) throw new Error(`중복된 일정 ID가 있습니다: ${schedule.id}`);
    ids.add(schedule.id);
    return schedule;
  });
  return { team: 'firehawks', schedules };
}

async function getBranchHead() {
  const ref = await githubRequest(`/repos/${REPOSITORY}/git/ref/heads/${encodeURIComponent(BRANCH)}`);
  const sha = ref?.object?.sha;
  if (typeof sha !== 'string' || !/^[a-f0-9]{40}$/.test(sha)) {
    throw new Error('GitHub 브랜치 상태를 확인할 수 없습니다.');
  }
  return sha;
}

async function loadManifest(team, commitSha) {
  const path = TEAMS[team].dataPath;
  const raw = await githubRequest(
    `/repos/${REPOSITORY}/contents/${path}?ref=${encodeURIComponent(commitSha)}`,
    {
      accept: 'application/vnd.github.raw+json',
      responseType: 'text',
    },
  );
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${TEAMS[team].label} 활동 파일이 올바른 JSON이 아닙니다.`);
  }
  return normalizeManifest(parsed, team);
}

async function loadScheduleManifest(commitSha) {
  const raw = await githubRequest(
    `/repos/${REPOSITORY}/contents/${SCHEDULE_PATH}?ref=${encodeURIComponent(commitSha)}`,
    {
      accept: 'application/vnd.github.raw+json',
      responseType: 'text',
    },
  );
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('FireHawks 출전 일정 파일이 올바른 JSON이 아닙니다.');
  }
  return normalizeScheduleManifest(parsed);
}

async function loadManifests() {
  if (!state.token) return;
  setBusy(true);
  setStatus('GitHub에서 최신 활동을 불러오고 있습니다.', 'info');
  try {
    const headSha = await getBranchHead();
    const scheduleResultPromise = loadScheduleManifest(headSha).then(
      value => ({ value, error: null }),
      error => ({ value: null, error }),
    );
    const [stayup, firehawks, scheduleResult] = await Promise.all([
      loadManifest('stayup', headSha),
      loadManifest('firehawks', headSha),
      scheduleResultPromise,
    ]);
    const scheduleManifest = scheduleResult.value;
    const scheduleLoadError = scheduleResult.error;
    if (scheduleLoadError instanceof GitHubApiError && scheduleLoadError.status === 401) {
      throw scheduleLoadError;
    }
    if (scheduleLoadError) {
      console.error(
        '[관리 화면] FireHawks 출전 일정을 불러오지 못했습니다.',
        scheduleLoadError,
      );
    }
    state.headSha = headSha;
    state.manifests.stayup = stayup;
    state.manifests.firehawks = firehawks;
    state.scheduleManifest = scheduleManifest;
    renderManager();
    if (scheduleLoadError) {
      setStatus(
        '활동 기록은 불러왔지만 FireHawks 출전 일정 파일을 불러오지 못했습니다. 일정 관리만 잠시 사용할 수 없습니다.',
        'warning',
      );
    } else {
      setStatus('최신 활동과 출전 일정을 불러왔습니다.', 'success');
    }
  } catch (error) {
    if (error instanceof GitHubApiError && error.status === 401) resetSession();
    setStatus(friendlyError(error), 'error');
    throw error;
  } finally {
    setBusy(false);
  }
}

function formatDate(date) {
  const match = DATE_PATTERN.exec(date);
  if (!match) return date;
  if (!match[2]) return match[1];
  if (!match[3]) return `${match[1]}. ${match[2]}`;
  return `${match[1]}. ${match[2]}. ${match[3]}`;
}

function activityDateLabel(activity) {
  if (activity.displayDate) return activity.displayDate;
  if (!activity.endDate) return formatDate(activity.date);
  return `${formatDate(activity.date)} — ${formatDate(activity.endDate)}`;
}

function sortActivities(activities) {
  return [...activities].sort((left, right) => {
    const dateDifference =
      parseDateBoundary(right.endDate || right.date, true) -
      parseDateBoundary(left.endDate || left.date, true);
    if (dateDifference !== 0) return dateDifference;
    if (right.order !== left.order) return right.order - left.order;
    return left.id.localeCompare(right.id, 'ko');
  });
}

function seoulTodayBoundary() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day));
}

function scheduleTemporalState(schedule) {
  const today = seoulTodayBoundary();
  const start = parseDateBoundary(schedule.date);
  const end = parseDateBoundary(schedule.endDate || schedule.date, true);
  if (end < today) return 'ended';
  if (start <= today) return 'ongoing';
  return 'upcoming';
}

function scheduleStateLabel(schedule) {
  if (!schedule.published) return { key: 'hidden', label: '사이트에서 숨김' };
  const temporalState = scheduleTemporalState(schedule);
  if (temporalState === 'ended') return { key: 'ended', label: '종료됨' };
  if (temporalState === 'ongoing') return { key: 'ongoing', label: '진행 중' };
  return { key: 'upcoming', label: '예정' };
}

function sortSchedules(schedules) {
  const stateOrder = { ongoing: 0, upcoming: 1, ended: 2 };
  return [...schedules].sort((left, right) => {
    const leftState = scheduleTemporalState(left);
    const rightState = scheduleTemporalState(right);
    if (stateOrder[leftState] !== stateOrder[rightState]) {
      return stateOrder[leftState] - stateOrder[rightState];
    }
    const leftStart = parseDateBoundary(left.date);
    const rightStart = parseDateBoundary(right.date);
    if (leftState === 'ended' && rightState === 'ended') {
      const leftEnd = parseDateBoundary(left.endDate || left.date, true);
      const rightEnd = parseDateBoundary(right.endDate || right.date, true);
      if (leftEnd !== rightEnd) return rightEnd - leftEnd;
    } else if (leftStart !== rightStart) {
      return leftStart - rightStart;
    }
    if (right.order !== left.order) return right.order - left.order;
    return left.id.localeCompare(right.id, 'ko');
  });
}

function renderManager() {
  const stayupCount = state.manifests.stayup?.activities.length || 0;
  const firehawksCount = state.manifests.firehawks?.activities.length || 0;
  elements.stayupCount.textContent = `${stayupCount}개`;
  elements.firehawksCount.textContent = `${firehawksCount}개`;

  elements.teamButtons.forEach(button => {
    const selected = button.dataset.team === state.selectedTeam;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });

  const team = TEAMS[state.selectedTeam];
  const manifest = state.manifests[state.selectedTeam];
  elements.selectedTeamTitle.textContent = `${team.label} 활동 목록`;
  renderActivityList(manifest?.activities || []);

  const showScheduleManager = state.selectedTeam === 'firehawks';
  elements.scheduleManager.hidden = !showScheduleManager;
  if (showScheduleManager) {
    if (state.scheduleManifest) {
      renderScheduleList(state.scheduleManifest.schedules);
    } else {
      elements.scheduleSummary.textContent = '출전 일정을 불러오지 못했습니다.';
      elements.scheduleList.replaceChildren();
      const unavailable = createElement('div', 'empty-state');
      unavailable.append(
        createElement('strong', '', '출전 일정 관리만 잠시 사용할 수 없습니다.'),
        createElement('span', '', '새로고침 후에도 계속되면 일정 데이터 파일을 확인해 주세요.'),
      );
      elements.scheduleList.append(unavailable);
      elements.addScheduleButton.disabled = true;
    }
  }
}

function renderActivityList(activities) {
  elements.activityList.replaceChildren();
  const publishedCount = activities.filter(activity => activity.published).length;
  const hiddenCount = activities.length - publishedCount;
  elements.activitySummary.textContent = `공개 ${publishedCount}개 · 숨김 ${hiddenCount}개 · 총 ${activities.length}개`;

  if (activities.length === 0) {
    const empty = createElement('div', 'empty-state');
    empty.append(
      createElement('strong', '', '등록된 활동이 없습니다.'),
      createElement('span', '', '새 활동 등록 버튼으로 첫 기록을 추가하세요.'),
    );
    elements.activityList.append(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  sortActivities(activities).forEach(activity => {
    const card = createElement('article', 'activity-card');
    if (!activity.published) card.classList.add('is-hidden');

    const imageContainer = createElement('div', 'activity-card__image');
    const image = document.createElement('img');
    image.src = activityPreviewUrl(activity.image);
    image.alt = activity.imageAlt;
    image.width = activity.imageWidth;
    image.height = activity.imageHeight;
    image.loading = 'lazy';
    image.decoding = 'async';
    image.addEventListener(
      'error',
      () => {
        image.remove();
        imageContainer.append(createElement('span', 'visibility-label', '사진 확인 필요'));
      },
      { once: true },
    );
    imageContainer.append(image);
    if (!activity.published) {
      imageContainer.append(createElement('span', 'visibility-label', '사이트에서 숨김'));
    }

    const body = createElement('div', 'activity-card__body');
    const meta = createElement('div', 'activity-meta');
    meta.append(
      createElement('span', 'category-label', activity.category),
      createElement('span', '', activityDateLabel(activity)),
    );
    if (activity.badge) meta.append(createElement('span', '', activity.badge));
    const title = createElement('h4', '', activity.title);
    const description = createElement('p', 'activity-card__description', activity.description);
    body.append(meta, title, description);

    const actions = createElement('div', 'activity-card__actions');
    const editButton = createElement('button', 'card-button', '수정');
    editButton.type = 'button';
    editButton.addEventListener('click', () => openEditor(activity));
    const visibilityButton = createElement(
      'button',
      `card-button${activity.published ? ' card-button--hide' : ''}`,
      activity.published ? '숨기기' : '다시 공개',
    );
    visibilityButton.type = 'button';
    visibilityButton.addEventListener('click', () => {
      void toggleActivityVisibility(activity);
    });
    actions.append(editButton, visibilityButton);

    card.append(imageContainer, body, actions);
    fragment.append(card);
  });
  elements.activityList.append(fragment);
}

function renderScheduleList(schedules) {
  elements.scheduleList.replaceChildren();
  const activeCount = schedules.filter(
    schedule => schedule.published && scheduleTemporalState(schedule) !== 'ended',
  ).length;
  const endedCount = schedules.filter(
    schedule => schedule.published && scheduleTemporalState(schedule) === 'ended',
  ).length;
  const hiddenCount = schedules.filter(schedule => !schedule.published).length;
  elements.scheduleSummary.textContent =
    `공개 예정·진행 ${activeCount}개 · 공개 종료 ${endedCount}개 · 숨김 ${hiddenCount}개 · 총 ${schedules.length}개`;

  if (schedules.length === 0) {
    const empty = createElement('div', 'empty-state');
    empty.append(
      createElement('strong', '', '등록된 출전 일정이 없습니다.'),
      createElement('span', '', '새 일정 등록 버튼으로 다음 출전 일정을 추가하세요.'),
    );
    elements.scheduleList.append(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  sortSchedules(schedules).forEach(schedule => {
    const temporalState = scheduleTemporalState(schedule);
    const visibleState = scheduleStateLabel(schedule);
    const card = createElement('article', 'schedule-admin-card');
    if (!schedule.published) card.classList.add('is-hidden');
    if (temporalState === 'ended') card.classList.add('is-ended');

    const body = createElement('div', 'schedule-admin-card__body');
    const meta = createElement('div', 'schedule-admin-card__meta');
    meta.append(
      createElement(
        'span',
        `schedule-state schedule-state--${visibleState.key}`,
        visibleState.label,
      ),
      createElement('span', '', activityDateLabel(schedule)),
    );

    const title = createElement('h4', '', schedule.title);
    const facts = createElement('p', 'schedule-admin-card__facts');
    facts.append(createElement('span', '', `장소 · ${schedule.location}`));
    if (schedule.division) {
      facts.append(createElement('span', '', `출전 부문 · ${schedule.division}`));
    }
    body.append(meta, title, facts);
    if (schedule.description) {
      body.append(createElement('p', 'schedule-admin-card__description', schedule.description));
    }

    const actions = createElement('div', 'schedule-admin-card__actions');
    const editButton = createElement('button', 'card-button', '수정');
    editButton.type = 'button';
    editButton.addEventListener('click', () => openScheduleEditor(schedule));
    const visibilityButton = createElement(
      'button',
      `card-button${schedule.published ? ' card-button--hide' : ''}`,
      schedule.published ? '숨기기' : '다시 공개',
    );
    visibilityButton.type = 'button';
    visibilityButton.addEventListener('click', () => {
      void toggleScheduleVisibility(schedule);
    });
    actions.append(editButton, visibilityButton);

    card.append(body, actions);
    fragment.append(card);
  });
  elements.scheduleList.append(fragment);
}

function clearProcessedImage() {
  state.imageProcessVersion += 1;
  state.processedImage = null;
  state.imageProcessing = false;
  if (state.previewObjectUrl) {
    URL.revokeObjectURL(state.previewObjectUrl);
    state.previewObjectUrl = null;
  }
  elements.activityImage.value = '';
}

function showImagePreview(src, details, alt) {
  elements.imagePreview.src = src;
  elements.imagePreview.alt = alt || '대표 사진 미리보기';
  elements.imagePreviewDetails.textContent = details;
  elements.imagePreviewPanel.hidden = false;
}

function openEditor(activity = null) {
  if (state.busy || !state.manifests[state.selectedTeam]) return;
  state.editorInvoker = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;
  clearProcessedImage();
  clearEditorStatus();
  elements.activityForm.reset();
  elements.editorFields.scrollTop = 0;
  state.editingActivity = activity ? { ...activity } : null;

  const team = state.selectedTeam;
  elements.activityTeam.value = team;
  elements.activityId.value = activity?.id || '';
  elements.editorTeamLabel.textContent = TEAMS[team].label.toUpperCase();
  elements.editorTitle.textContent = activity ? '활동 수정' : '새 활동 등록';
  elements.activityDate.value = activity?.date || '';
  elements.activityEndDate.value = activity?.endDate || '';
  elements.activityDisplayDate.value = activity?.displayDate || '';
  elements.activityCategory.value = activity?.category || '';
  elements.activityTitle.value = activity?.title || '';
  elements.activityDescription.value = activity?.description || '';
  elements.activityBadge.value = activity?.badge || '';
  elements.activityBadgeTone.value = activity?.badgeTone || 'default';
  elements.activityImageAlt.value = activity?.imageAlt || '';
  elements.activityPublished.checked = activity ? activity.published : true;

  if (activity) {
    showImagePreview(
      activityPreviewUrl(activity.image),
      `현재 사진 · ${activity.imageWidth} × ${activity.imageHeight}px · 새 사진을 선택하지 않으면 유지됩니다.`,
      activity.imageAlt,
    );
    elements.imageHelp.textContent = '새 사진을 선택하면 위치정보를 제거한 WebP 이미지로 교체됩니다.';
  } else {
    elements.imagePreviewPanel.hidden = true;
    elements.imagePreview.removeAttribute('src');
    elements.imageHelp.textContent = '새 활동에는 대표 사진이 필요합니다.';
  }

  if (typeof elements.editorDialog.showModal === 'function') {
    elements.editorDialog.showModal();
  } else {
    elements.editorDialog.setAttribute('open', '');
  }
  const avoidOpeningKeyboard = window.matchMedia('(pointer: coarse)').matches
    || window.innerWidth <= 820;
  window.setTimeout(() => {
    elements.editorFields.scrollTop = 0;
    (avoidOpeningKeyboard ? elements.closeEditorButton : elements.activityDate).focus();
  }, 0);
}

function closeEditor() {
  if (elements.editorFields.disabled) return;
  const invoker = state.editorInvoker;
  state.editorInvoker = null;
  if (elements.editorDialog.open && typeof elements.editorDialog.close === 'function') {
    elements.editorDialog.close();
  } else {
    elements.editorDialog.removeAttribute('open');
  }
  state.editingActivity = null;
  clearProcessedImage();
  clearEditorStatus();
  window.setTimeout(() => {
    if (invoker?.isConnected) {
      invoker.focus();
    } else if (!elements.manager.hidden) {
      elements.addButton.focus();
    }
  }, 0);
}

function openScheduleEditor(schedule = null) {
  if (
    state.busy ||
    state.selectedTeam !== 'firehawks' ||
    !state.scheduleManifest
  ) {
    return;
  }
  state.scheduleEditorInvoker = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;
  clearScheduleEditorStatus();
  elements.scheduleForm.reset();
  elements.scheduleEditorFields.scrollTop = 0;
  state.editingSchedule = schedule ? { ...schedule } : null;

  elements.scheduleId.value = schedule?.id || '';
  elements.scheduleEditorTitle.textContent = schedule ? '출전 일정 수정' : '새 출전 일정 등록';
  elements.scheduleDate.value = schedule?.date || '';
  elements.scheduleEndDate.value = schedule?.endDate || '';
  elements.scheduleDisplayDate.value = schedule?.displayDate || '';
  elements.scheduleTitle.value = schedule?.title || '';
  elements.scheduleLocation.value = schedule?.location || '';
  elements.scheduleDivision.value = schedule?.division || '';
  elements.scheduleDescription.value = schedule?.description || '';
  elements.schedulePublished.checked = schedule ? schedule.published : true;

  if (typeof elements.scheduleEditorDialog.showModal === 'function') {
    elements.scheduleEditorDialog.showModal();
  } else {
    elements.scheduleEditorDialog.setAttribute('open', '');
  }
  const avoidOpeningKeyboard = window.matchMedia('(pointer: coarse)').matches
    || window.innerWidth <= 820;
  window.setTimeout(() => {
    elements.scheduleEditorFields.scrollTop = 0;
    (avoidOpeningKeyboard ? elements.closeScheduleEditorButton : elements.scheduleDate).focus();
  }, 0);
}

function closeScheduleEditor() {
  if (elements.scheduleEditorFields.disabled) return;
  const invoker = state.scheduleEditorInvoker;
  state.scheduleEditorInvoker = null;
  if (
    elements.scheduleEditorDialog.open &&
    typeof elements.scheduleEditorDialog.close === 'function'
  ) {
    elements.scheduleEditorDialog.close();
  } else {
    elements.scheduleEditorDialog.removeAttribute('open');
  }
  state.editingSchedule = null;
  clearScheduleEditorStatus();
  window.setTimeout(() => {
    if (invoker?.isConnected) {
      invoker.focus();
    } else if (!elements.scheduleManager.hidden) {
      elements.addScheduleButton.focus();
    }
  }, 0);
}

async function decodeImage(file) {
  if ('createImageBitmap' in window) {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close(),
      };
    } catch {
      // Fall back to an HTMLImageElement. Modern browsers apply EXIF orientation while decoding.
    }
  }

  const sourceUrl = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = 'async';
  image.src = sourceUrl;
  try {
    await image.decode();
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      cleanup: () => URL.revokeObjectURL(sourceUrl),
    };
  } catch {
    URL.revokeObjectURL(sourceUrl);
    throw new Error('사진을 읽을 수 없습니다. 다른 파일을 선택해 주세요.');
  }
}

function canvasToWebp(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (!blob || blob.type !== 'image/webp') {
          reject(new Error('이 브라우저에서 WebP 사진을 만들 수 없습니다. 최신 브라우저를 사용해 주세요.'));
          return;
        }
        resolve(blob);
      },
      'image/webp',
      WEBP_QUALITY,
    );
  });
}

async function processSelectedImage(file, processVersion) {
  if (processVersion !== state.imageProcessVersion) return;
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error('JPEG, PNG 또는 WebP 사진만 선택할 수 있습니다.');
  }
  if (file.size < 1 || file.size > MAX_IMAGE_BYTES) {
    throw new Error('사진은 15MB 이하여야 합니다.');
  }

  state.imageProcessing = true;
  elements.saveButton.disabled = true;
  elements.imagePreviewPanel.hidden = true;
  setStatus('사진 방향을 보정하고 위치정보를 제거하는 중입니다.', 'info');

  let decoded;
  try {
    decoded = await decodeImage(file);
    if (
      !Number.isInteger(decoded.width) ||
      !Number.isInteger(decoded.height) ||
      decoded.width < 1 ||
      decoded.height < 1 ||
      decoded.width > 30000 ||
      decoded.height > 30000
    ) {
      throw new Error('사진 크기를 확인할 수 없습니다.');
    }

    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(decoded.width, decoded.height));
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('사진 변환을 시작할 수 없습니다.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(decoded.source, 0, 0, width, height);
    const blob = await canvasToWebp(canvas);

    if (processVersion !== state.imageProcessVersion) return;
    if (state.previewObjectUrl) URL.revokeObjectURL(state.previewObjectUrl);
    state.previewObjectUrl = URL.createObjectURL(blob);
    state.processedImage = { blob, width, height, sourceName: file.name };
    showImagePreview(
      state.previewObjectUrl,
      `${width} × ${height}px · WebP ${Math.max(1, Math.round(blob.size / 1024)).toLocaleString('ko-KR')}KB · EXIF·GPS 제거 완료`,
      'WebP로 안전하게 변환된 대표 사진 미리보기',
    );
    elements.imageHelp.textContent = '원본 파일은 업로드되지 않으며 변환된 WebP 사진만 저장됩니다.';
    setStatus('사진 변환이 완료되었습니다. 원본의 위치정보는 저장되지 않습니다.', 'success');
  } finally {
    decoded?.cleanup();
    if (processVersion === state.imageProcessVersion) {
      state.imageProcessing = false;
      elements.saveButton.disabled = false;
    }
  }
}

function generateActivityId(team, date, activities) {
  const compactDate = date.replaceAll('-', '');
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const random = crypto.getRandomValues(new Uint32Array(1))[0].toString(36).padStart(6, '0');
    const id = `${team}-${compactDate}-${random}`.slice(0, 80);
    if (!activities.some(activity => activity.id === id)) return id;
  }
  throw new Error('활동 고유 ID를 만들 수 없습니다. 다시 시도해 주세요.');
}

function nextOrderForDate(activities, date, ignoredId = '') {
  const sameDateOrders = activities
    .filter(activity => activity.id !== ignoredId && activity.date === date)
    .map(activity => activity.order || 0);
  const nextOrder = (sameDateOrders.length ? Math.max(...sameDateOrders) : -1) + 1;
  if (nextOrder > 9999) throw new Error('같은 날짜에 등록된 활동 순서가 너무 많습니다.');
  return nextOrder;
}

function optionalField(activity, key, value) {
  if (value) activity[key] = value;
}

function buildActivityFromForm() {
  const manifest = state.manifests[state.selectedTeam];
  if (!manifest) throw new Error('활동 목록을 먼저 불러와 주세요.');

  const original = state.editingActivity;
  const date = elements.activityDate.value.trim();
  parseDateBoundary(date);
  const endDate = elements.activityEndDate.value.trim();
  if (endDate) {
    parseDateBoundary(endDate, true);
    if (parseDateBoundary(endDate, true) < parseDateBoundary(date)) {
      throw new Error('종료일은 시작일보다 빠를 수 없습니다.');
    }
  }

  if (!original && !state.processedImage) {
    throw new Error('새 활동에 사용할 대표 사진을 선택해 주세요.');
  }
  const id = original?.id || generateActivityId(state.selectedTeam, date, manifest.activities);
  const imagePath = state.processedImage
    ? `/images/activity-uploads/${id}-${Date.now().toString(36)}.webp`
    : original.image;
  const imageWidth = state.processedImage?.width || original.imageWidth;
  const imageHeight = state.processedImage?.height || original.imageHeight;
  const order =
    original && original.date === date
      ? original.order
      : nextOrderForDate(manifest.activities, date, original?.id);

  const activity = {
    id,
    date,
    category: elements.activityCategory.value.trim(),
    title: elements.activityTitle.value.trim(),
    description: elements.activityDescription.value.trim(),
    image: imagePath,
    imageAlt: elements.activityImageAlt.value.trim(),
    imageWidth,
    imageHeight,
    order,
    published: elements.activityPublished.checked,
  };
  optionalField(activity, 'endDate', endDate);
  optionalField(activity, 'displayDate', elements.activityDisplayDate.value.trim());
  const badge = elements.activityBadge.value.trim();
  optionalField(activity, 'badge', badge);
  if (badge) activity.badgeTone = elements.activityBadgeTone.value;
  return normalizeActivity(activity);
}

function generateScheduleId(date, schedules) {
  const compactDate = date.replaceAll('-', '');
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const random = crypto.getRandomValues(new Uint32Array(1))[0].toString(36).padStart(6, '0');
    const id = `firehawks-schedule-${compactDate}-${random}`.slice(0, 80);
    if (!schedules.some(schedule => schedule.id === id)) return id;
  }
  throw new Error('일정 고유 ID를 만들 수 없습니다. 다시 시도해 주세요.');
}

function nextScheduleOrderForDate(schedules, date, ignoredId = '') {
  const sameDateOrders = schedules
    .filter(schedule => schedule.id !== ignoredId && schedule.date === date)
    .map(schedule => schedule.order || 0);
  const nextOrder = (sameDateOrders.length ? Math.max(...sameDateOrders) : -1) + 1;
  if (nextOrder > 9999) throw new Error('같은 날짜에 등록된 일정 순서가 너무 많습니다.');
  return nextOrder;
}

function buildScheduleFromForm() {
  const manifest = state.scheduleManifest;
  if (!manifest) throw new Error('출전 일정 목록을 먼저 불러와 주세요.');

  const original = state.editingSchedule;
  const date = elements.scheduleDate.value.trim();
  parseDateBoundary(date);
  const endDate = elements.scheduleEndDate.value.trim();
  if (endDate) {
    parseDateBoundary(endDate, true);
    if (parseDateBoundary(endDate, true) < parseDateBoundary(date)) {
      throw new Error('일정 종료일은 시작일보다 빠를 수 없습니다.');
    }
  }

  const id = original?.id || generateScheduleId(date, manifest.schedules);
  const order =
    original && original.date === date
      ? original.order
      : nextScheduleOrderForDate(manifest.schedules, date, original?.id);
  const schedule = {
    id,
    date,
    title: elements.scheduleTitle.value.trim(),
    location: elements.scheduleLocation.value.trim(),
    order,
    published: elements.schedulePublished.checked,
  };
  optionalField(schedule, 'endDate', endDate);
  optionalField(schedule, 'displayDate', elements.scheduleDisplayDate.value.trim());
  optionalField(schedule, 'division', elements.scheduleDivision.value.trim());
  optionalField(schedule, 'description', elements.scheduleDescription.value.trim());
  return normalizeSchedule(schedule);
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('error', () => reject(new Error('변환된 사진을 읽을 수 없습니다.')));
    reader.addEventListener('load', () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('변환된 사진을 읽을 수 없습니다.'));
        return;
      }
      const separator = reader.result.indexOf(',');
      if (separator === -1) {
        reject(new Error('변환된 사진 형식이 올바르지 않습니다.'));
        return;
      }
      resolve(reader.result.slice(separator + 1));
    });
    reader.readAsDataURL(blob);
  });
}

async function createBlob(content, encoding) {
  const result = await githubRequest(`/repos/${REPOSITORY}/git/blobs`, {
    method: 'POST',
    body: { content, encoding },
  });
  if (typeof result?.sha !== 'string') throw new Error('GitHub 파일 객체를 만들지 못했습니다.');
  return result.sha;
}

async function commitData({ dataPath, payload, image, imagePath, message }) {
  const expectedHead = state.headSha;
  if (!expectedHead) throw new Error('저장소 기준 버전을 확인할 수 없습니다. 새로고침해 주세요.');
  const currentHead = await getBranchHead();
  if (currentHead !== expectedHead) throw new ContentConflictError();

  const baseCommit = await githubRequest(`/repos/${REPOSITORY}/git/commits/${currentHead}`);
  const baseTreeSha = baseCommit?.tree?.sha;
  if (typeof baseTreeSha !== 'string') throw new Error('GitHub 기준 파일 트리를 확인할 수 없습니다.');

  const jsonContent = `${JSON.stringify(payload, null, 2)}\n`;
  const jsonBlobPromise = createBlob(jsonContent, 'utf-8');
  const imageBlobPromise = image
    ? blobToBase64(image.blob).then(content => createBlob(content, 'base64'))
    : Promise.resolve(null);
  const [jsonBlobSha, imageBlobSha] = await Promise.all([jsonBlobPromise, imageBlobPromise]);

  const treeEntries = [
    {
      path: dataPath,
      mode: '100644',
      type: 'blob',
      sha: jsonBlobSha,
    },
  ];
  if (image && imageBlobSha) {
    treeEntries.push({
      path: imagePath.replace(/^\//, ''),
      mode: '100644',
      type: 'blob',
      sha: imageBlobSha,
    });
  }

  const tree = await githubRequest(`/repos/${REPOSITORY}/git/trees`, {
    method: 'POST',
    body: { base_tree: baseTreeSha, tree: treeEntries },
  });
  if (typeof tree?.sha !== 'string') throw new Error('GitHub 변경 파일 트리를 만들지 못했습니다.');

  const commit = await githubRequest(`/repos/${REPOSITORY}/git/commits`, {
    method: 'POST',
    body: {
      message,
      tree: tree.sha,
      parents: [currentHead],
    },
  });
  if (typeof commit?.sha !== 'string') throw new Error('GitHub 커밋을 만들지 못했습니다.');

  try {
    await githubRequest(`/repos/${REPOSITORY}/git/refs/heads/${encodeURIComponent(BRANCH)}`, {
      method: 'PATCH',
      body: { sha: commit.sha, force: false },
    });
  } catch (error) {
    if (error instanceof GitHubApiError && (error.status === 409 || error.status === 422)) {
      try {
        const latestHead = await getBranchHead();
        if (latestHead !== currentHead) throw new ContentConflictError();
      } catch (headError) {
        if (headError instanceof ContentConflictError) throw headError;
      }
    }
    throw error;
  }
  return commit.sha;
}

function buildCommitMessage(action, title) {
  const cleanTitle = title.replace(/\s+/g, ' ').trim().slice(0, 80);
  return `cms: ${TEAMS[state.selectedTeam].label} 활동 ${action} - ${cleanTitle}`;
}

async function saveActivity(event) {
  event.preventDefault();
  if (state.busy || state.imageProcessing) {
    setStatus('사진 변환 또는 다른 저장 작업이 끝날 때까지 기다려 주세요.', 'warning');
    return;
  }
  if (!elements.activityForm.reportValidity()) return;

  let activity;
  try {
    activity = buildActivityFromForm();
  } catch (error) {
    setStatus(friendlyError(error), 'error');
    return;
  }

  const original = state.editingActivity;
  if (original?.published && !activity.published) {
    const confirmed = window.confirm(
      '이 활동을 사이트에서 숨길까요? 기록과 사진은 삭제되지 않으며 나중에 다시 공개할 수 있습니다.',
    );
    if (!confirmed) return;
  }

  const manifest = state.manifests[state.selectedTeam];
  const activities = original
    ? manifest.activities.map(item => (item.id === original.id ? activity : item))
    : [...manifest.activities, activity];
  const nextManifest = { team: state.selectedTeam, activities };
  const image = state.processedImage;
  const action = original ? '수정' : '추가';

  setEditorBusy(true);
  setBusy(true);
  setStatus('사진과 활동 내용을 하나의 안전한 커밋으로 저장하고 있습니다.', 'info');
  try {
    const commitSha = await commitData({
      dataPath: TEAMS[state.selectedTeam].dataPath,
      payload: nextManifest,
      image,
      imagePath: activity.image,
      message: buildCommitMessage(action, activity.title),
    });
    state.manifests[state.selectedTeam] = nextManifest;
    state.headSha = commitSha;
    setEditorBusy(false);
    closeEditor();
    renderManager();
    setStatus('저장이 완료되었습니다. Vercel 배포 후 사이트에 자동 반영됩니다.', 'success');
  } catch (error) {
    if (error instanceof GitHubApiError && error.status === 401) resetSession();
    setStatus(friendlyError(error), error instanceof ContentConflictError ? 'warning' : 'error');
  } finally {
    setEditorBusy(false);
    setBusy(false);
  }
}

async function toggleActivityVisibility(activity) {
  if (state.busy) return;
  if (activity.published) {
    const confirmed = window.confirm(
      '이 활동을 사이트에서 숨길까요? 기록과 사진은 삭제되지 않으며 언제든 다시 공개할 수 있습니다.',
    );
    if (!confirmed) return;
  }

  const manifest = state.manifests[state.selectedTeam];
  const nextActivity = { ...activity, published: !activity.published };
  const nextManifest = {
    team: state.selectedTeam,
    activities: manifest.activities.map(item =>
      item.id === activity.id ? nextActivity : item,
    ),
  };
  const action = nextActivity.published ? '공개' : '숨김';

  setBusy(true);
  setStatus(`활동을 ${action} 처리하고 있습니다.`, 'info');
  try {
    const commitSha = await commitData({
      dataPath: TEAMS[state.selectedTeam].dataPath,
      payload: nextManifest,
      image: null,
      imagePath: '',
      message: buildCommitMessage(action, activity.title),
    });
    state.manifests[state.selectedTeam] = nextManifest;
    state.headSha = commitSha;
    renderManager();
    setStatus(
      nextActivity.published
        ? '활동을 다시 공개했습니다. 배포 후 사이트에 표시됩니다.'
        : '활동을 숨겼습니다. 기록과 사진은 안전하게 보존됩니다.',
      'success',
    );
  } catch (error) {
    if (error instanceof GitHubApiError && error.status === 401) resetSession();
    setStatus(friendlyError(error), error instanceof ContentConflictError ? 'warning' : 'error');
    if (error instanceof ContentConflictError) {
      try {
        await loadManifests();
      } catch {
        // loadManifests already reports the failure.
      }
    }
  } finally {
    setBusy(false);
  }
}

function buildScheduleCommitMessage(action, title) {
  const cleanTitle = title.replace(/\s+/g, ' ').trim().slice(0, 80);
  return `cms: FireHawks 출전 일정 ${action} - ${cleanTitle}`;
}

async function saveSchedule(event) {
  event.preventDefault();
  if (state.busy) {
    setStatus('다른 저장 작업이 끝날 때까지 기다려 주세요.', 'warning');
    return;
  }
  if (!elements.scheduleForm.reportValidity()) return;

  let schedule;
  try {
    schedule = buildScheduleFromForm();
  } catch (error) {
    setStatus(friendlyError(error), 'error');
    return;
  }

  const original = state.editingSchedule;
  if (original?.published && !schedule.published) {
    const confirmed = window.confirm(
      '이 출전 일정을 사이트에서 숨길까요? 일정은 삭제되지 않으며 나중에 다시 공개할 수 있습니다.',
    );
    if (!confirmed) return;
  }

  const manifest = state.scheduleManifest;
  const schedules = original
    ? manifest.schedules.map(item => (item.id === original.id ? schedule : item))
    : [...manifest.schedules, schedule];
  const nextManifest = { team: 'firehawks', schedules };
  const action = original ? '수정' : '추가';

  setScheduleEditorBusy(true);
  setBusy(true);
  setStatus('출전 일정을 안전한 GitHub 커밋으로 저장하고 있습니다.', 'info');
  try {
    const commitSha = await commitData({
      dataPath: SCHEDULE_PATH,
      payload: nextManifest,
      image: null,
      imagePath: '',
      message: buildScheduleCommitMessage(action, schedule.title),
    });
    state.scheduleManifest = nextManifest;
    state.headSha = commitSha;
    setScheduleEditorBusy(false);
    closeScheduleEditor();
    renderManager();
    setStatus('출전 일정 저장이 완료되었습니다. Vercel 배포 후 사이트에 자동 반영됩니다.', 'success');
  } catch (error) {
    if (error instanceof GitHubApiError && error.status === 401) resetSession();
    setStatus(friendlyError(error), error instanceof ContentConflictError ? 'warning' : 'error');
    if (error instanceof ContentConflictError) {
      try {
        await loadManifests();
      } catch {
        // loadManifests already reports the failure.
      }
    }
  } finally {
    setScheduleEditorBusy(false);
    setBusy(false);
  }
}

async function toggleScheduleVisibility(schedule) {
  if (state.busy || !state.scheduleManifest) return;
  if (schedule.published) {
    const confirmed = window.confirm(
      '이 출전 일정을 사이트에서 숨길까요? 일정은 삭제되지 않으며 언제든 다시 공개할 수 있습니다.',
    );
    if (!confirmed) return;
  }

  const nextSchedule = { ...schedule, published: !schedule.published };
  const nextManifest = {
    team: 'firehawks',
    schedules: state.scheduleManifest.schedules.map(item =>
      item.id === schedule.id ? nextSchedule : item,
    ),
  };
  const action = nextSchedule.published ? '공개' : '숨김';

  setBusy(true);
  setStatus(`출전 일정을 ${action} 처리하고 있습니다.`, 'info');
  try {
    const commitSha = await commitData({
      dataPath: SCHEDULE_PATH,
      payload: nextManifest,
      image: null,
      imagePath: '',
      message: buildScheduleCommitMessage(action, schedule.title),
    });
    state.scheduleManifest = nextManifest;
    state.headSha = commitSha;
    renderManager();
    setStatus(
      nextSchedule.published
        ? '출전 일정을 다시 공개했습니다. 배포 후 사이트에 표시됩니다.'
        : '출전 일정을 숨겼습니다. 일정은 안전하게 보존됩니다.',
      'success',
    );
  } catch (error) {
    if (error instanceof GitHubApiError && error.status === 401) resetSession();
    setStatus(friendlyError(error), error instanceof ContentConflictError ? 'warning' : 'error');
    if (error instanceof ContentConflictError) {
      try {
        await loadManifests();
      } catch {
        // loadManifests already reports the failure.
      }
    }
  } finally {
    setBusy(false);
  }
}

function selectTeam(team) {
  if (!TEAMS[team] || state.busy) return;
  state.selectedTeam = team;
  renderManager();
}

async function restoreSession() {
  const token = readSessionToken();
  if (!token) {
    resetSession();
    setStatus('GitHub에 로그인하면 활동 기록을 관리할 수 있습니다.', 'info');
    return;
  }

  setStatus('기존 GitHub 로그인을 확인하고 있습니다.', 'info');
  elements.loginButton.disabled = true;
  try {
    await verifyGitHubAccess(token);
    renderAuthenticationState();
    await loadManifests();
    setStatus(`${state.user.login} 계정으로 연결되었습니다.`, 'success');
  } catch (error) {
    resetSession();
    setStatus(friendlyError(error), 'warning');
  } finally {
    elements.loginButton.disabled = false;
  }
}

elements.loginButton.addEventListener('click', beginGitHubLogin);
elements.logoutButton.addEventListener('click', () => {
  if (state.busy) return;
  resetSession();
  setStatus('로그아웃했습니다. 이 탭에 저장된 GitHub 토큰을 삭제했습니다.', 'success');
});
elements.refreshButton.addEventListener('click', () => {
  void loadManifests().catch(() => {});
});
elements.addButton.addEventListener('click', () => openEditor());
elements.addScheduleButton.addEventListener('click', () => openScheduleEditor());
elements.teamButtons.forEach(button => {
  button.addEventListener('click', () => selectTeam(button.dataset.team));
});
elements.closeEditorButton.addEventListener('click', closeEditor);
elements.cancelEditorButton.addEventListener('click', closeEditor);
elements.editorDialog.addEventListener('cancel', event => {
  event.preventDefault();
  if (elements.editorFields.disabled) {
    return;
  }
  closeEditor();
});
elements.closeScheduleEditorButton.addEventListener('click', closeScheduleEditor);
elements.cancelScheduleEditorButton.addEventListener('click', closeScheduleEditor);
elements.scheduleEditorDialog.addEventListener('cancel', event => {
  event.preventDefault();
  if (elements.scheduleEditorFields.disabled) return;
  closeScheduleEditor();
});
elements.activityImage.addEventListener('change', () => {
  const [file] = elements.activityImage.files || [];
  if (!file) return;
  const processVersion = ++state.imageProcessVersion;
  void processSelectedImage(file, processVersion).catch(error => {
    if (processVersion !== state.imageProcessVersion) return;
    if (state.previewObjectUrl) {
      URL.revokeObjectURL(state.previewObjectUrl);
      state.previewObjectUrl = null;
    }
    state.processedImage = null;
    state.imageProcessing = false;
    elements.activityImage.value = '';
    elements.saveButton.disabled = false;
    if (state.editingActivity) {
      showImagePreview(
        activityPreviewUrl(state.editingActivity.image),
        `현재 사진 · ${state.editingActivity.imageWidth} × ${state.editingActivity.imageHeight}px`,
        state.editingActivity.imageAlt,
      );
    } else {
      elements.imagePreviewPanel.hidden = true;
    }
    setStatus(friendlyError(error), 'error');
  });
});
elements.activityForm.addEventListener('submit', event => {
  void saveActivity(event);
});
elements.scheduleForm.addEventListener('submit', event => {
  void saveSchedule(event);
});

void restoreSession();
