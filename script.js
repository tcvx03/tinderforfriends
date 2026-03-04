let db = null;

const SEED_PEOPLE = [
  { name: 'Alex Chen',      grade: 'Grade 12', interests: 'Basketball, Music, Coding',        availability: 'Lunch',   contact: '@alex.chen'    },
  { name: 'Jordan Kim',     grade: 'Grade 11', interests: 'Art, Reading, Soccer',             availability: 'Library', contact: '@j.kim'        },
  { name: 'Sam Patel',      grade: 'Grade 12', interests: 'Gaming, Photography, Cooking',     availability: 'Both',    contact: '@sam.patel'    },
  { name: 'Taylor Wong',    grade: 'Grade 10', interests: 'Dance, Writing, Tennis',           availability: 'Lunch',   contact: '@taylor.w'     },
  { name: 'Morgan Davis',   grade: 'Grade 11', interests: 'Chess, Anime, Running',            availability: 'Library', contact: '@morgan.d'     },
  { name: 'Casey Liu',      grade: 'Grade 12', interests: 'Music, Drama, Volleyball',         availability: 'Both',    contact: '@casey.liu'    },
  { name: 'Riley Thompson', grade: 'Grade 10', interests: 'Science, Hiking, Board Games',     availability: 'Lunch',   contact: '@riley.t'      },
  { name: 'Avery Martinez', grade: 'Grade 11', interests: 'Football, Drawing, Coding',        availability: 'Library', contact: '@avery.m'      },
  { name: 'Jamie Park',     grade: 'Grade 12', interests: 'Swimming, K-pop, Baking',          availability: 'Both',    contact: '@jamie.park'   },
  { name: 'Drew Nguyen',    grade: 'Grade 10', interests: 'Robotics, Skateboarding, Movies',  availability: 'Lunch',   contact: '@drew.n'       },
];

// ── Database helpers ──────────────────────────────────────────────────────────

function saveDB() {
  try {
    const data = db.export();
    // Convert Uint8Array → base64 in chunks to avoid call stack overflow on large DBs
    let binary = '';
    for (let i = 0; i < data.length; i++) binary += String.fromCharCode(data[i]);
    localStorage.setItem('t4f_db', btoa(binary));
  } catch (e) {
    console.error('Failed to save DB:', e);
  }
}

function tryLoadSavedDB(SQL) {
  const saved = localStorage.getItem('t4f_db');
  if (!saved) return null;
  try {
    const binary = atob(saved);
    const buf = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
    return new SQL.Database(buf);
  } catch (e) {
    console.warn('Saved DB corrupt, starting fresh:', e);
    return null;
  }
}

function initSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS people (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT NOT NULL,
      grade        TEXT NOT NULL,
      interests    TEXT NOT NULL,
      availability TEXT NOT NULL,
      contact      TEXT NOT NULL,
      added_at     DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

function seedData() {
  const [[count]] = db.exec('SELECT COUNT(*) FROM people')[0].values;
  if (count > 0) return;
  const stmt = db.prepare(
    'INSERT INTO people (name, grade, interests, availability, contact) VALUES (?,?,?,?,?)'
  );
  SEED_PEOPLE.forEach(p => stmt.run([p.name, p.grade, p.interests, p.availability, p.contact]));
  stmt.free();
  saveDB();
}

// ── Queries ───────────────────────────────────────────────────────────────────

function getRandomMatch() {
  const result = db.exec('SELECT * FROM people ORDER BY RANDOM() LIMIT 1');
  if (!result.length || !result[0].values.length) return null;
  const { columns, values: [row] } = result[0];
  return Object.fromEntries(columns.map((col, i) => [col, row[i]]));
}

function getAllPeople() {
  const result = db.exec('SELECT * FROM people ORDER BY name COLLATE NOCASE');
  if (!result.length) return [];
  const { columns, values } = result[0];
  return values.map(row => Object.fromEntries(columns.map((col, i) => [col, row[i]])));
}

function getPeopleCount() {
  return db.exec('SELECT COUNT(*) FROM people')[0].values[0][0];
}

function addPerson(name, grade, interests, availability, contact) {
  db.run(
    'INSERT INTO people (name, grade, interests, availability, contact) VALUES (?,?,?,?,?)',
    [name, grade, interests, availability, contact]
  );
  saveDB();
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function html(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str));
  return d.innerHTML;
}

const AVAILABILITY_LABEL = {
  Lunch:   '🍽️  Lunch',
  Library: '📚  Library',
  Both:    '🍽️  Lunch  &  📚  Library',
};

function renderIdleCard() {
  const card = document.getElementById('matchCard');
  card.classList.remove('has-match');
  card.innerHTML = `
    <div class="idle-card">
      <div class="idle-icon">👥</div>
      <div class="idle-text">Who will you meet?</div>
      <div class="idle-sub">Click the button below to find your match</div>
    </div>`;
}















function renderMatch(person) {
  const card = document.getElementById('matchCard');
  const tags = person.interests.split(',')
    .map(i => `<span class="tag">${html(i.trim())}</span>`)
    .join('');
  card.classList.add('has-match');
  card.innerHTML = `
    <div class="match-reveal">
      <div class="match-badge">✨ Your Match ✨</div>
      <div class="match-name">${html(person.name)}</div>
      <div class="match-grade">${html(person.grade)}</div>

      <div class="match-row">
        <span class="row-label">Interests</span>
        <div class="tags">${tags}</div>
      </div>

      <div class="match-row">
        <span class="row-label">Available to meet</span>
        <span class="match-avail">${AVAILABILITY_LABEL[person.availability] ?? html(person.availability)}</span>
      </div>

      <div class="match-row">
        <span class="row-label">Reach out</span>
        <span class="match-contact">${html(person.contact)}</span>
      </div>

      <div class="match-tip">
        💬 DM them and set up a time to chat at the library or during lunch!
      </div>
    </div>`;
}
















function updateCount() {
  const n = getPeopleCount();
  document.getElementById('peopleCount').textContent =
    `${n} friend${n !== 1 ? 's' : ''} in the pool`;
}

function renderPeopleList() {
  const list = document.getElementById('peopleList');
  const people = getAllPeople();
  if (!people.length) {
    list.innerHTML = '<p class="empty-msg">No one in the pool yet.</p>';
    return;
  }
  list.innerHTML = people.map(p => `
    <div class="person-item">
      <div class="person-name">${html(p.name)}</div>
      <div class="person-meta">${html(p.grade)} · ${html(p.availability)}</div>
    </div>`).join('');
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

async function init() {
  const loadingEl = document.getElementById('loading');
  const appEl     = document.getElementById('app');

  try {
    const SQL = await initSqlJs({
      locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${file}`,
    });

    db = tryLoadSavedDB(SQL) ?? new SQL.Database();
    initSchema();
    seedData();

    loadingEl.style.display = 'none';
    appEl.style.display = 'flex';

    renderIdleCard();
    updateCount();
    renderPeopleList();

    // ── Match button ──
    document.getElementById('matchBtn').addEventListener('click', () => {
      const btn = document.getElementById('matchBtn');
      btn.disabled = true;
      btn.textContent = 'Finding…';

      setTimeout(() => {
        const person = getRandomMatch();
        if (person) {
          renderMatch(person);
        } else {
          renderIdleCard();
          alert('The pool is empty! Add some people first.');
        }
        btn.disabled = false;
        btn.textContent = 'Find My Match! 💫';
      }, 500);
    });

    // ── Add-person form ──
    document.getElementById('addForm').addEventListener('submit', e => {
      e.preventDefault();
      const name         = document.getElementById('inputName').value.trim();
      const grade        = document.getElementById('inputGrade').value;
      const interests    = document.getElementById('inputInterests').value.trim();
      const availability = document.getElementById('inputAvailability').value;
      const contact      = document.getElementById('inputContact').value.trim();

      addPerson(name, grade, interests, availability, contact);
      e.target.reset();
      updateCount();
      renderPeopleList();

      const btn = e.target.querySelector('.submit-btn');
      const orig = btn.textContent;
      btn.textContent = 'Added! ✓';
      btn.classList.add('success');
      setTimeout(() => { btn.textContent = orig; btn.classList.remove('success'); }, 2000);
    });

    // ── Toggle people list ──
    document.getElementById('toggleList').addEventListener('click', function () {
      const list = document.getElementById('peopleList');
      const visible = list.style.display === 'grid';
      list.style.display = visible ? 'none' : 'grid';
      this.textContent = visible ? 'Show Everyone ▼' : 'Hide ▲';
    });

  } catch (err) {
    loadingEl.innerHTML = `<p style="color:#e94560;font-weight:600;">Failed to load — please refresh.</p>`;
    console.error(err);
  }
}

init();
