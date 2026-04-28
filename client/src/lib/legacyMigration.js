// One-shot migration from the old `stockline_*` localStorage keys to the new
// `ember_*` keys, run once per browser at app boot. Wired as the very first
// import in main.jsx so it executes before theme.js / prefs.js / Settings.jsx
// read any of these keys at module-load time.
//
// Safe to keep around indefinitely — gated by `ember_migration_v1_done` so it
// no-ops after the first successful run.

const KEY_MAP = {
  stockline_theme: 'ember_theme',
  stockline_table_density: 'ember_table_density',
  stockline_number_locale: 'ember_number_locale',
  stockline_chart_style: 'ember_chart_style',
  stockline_quiet_hours: 'ember_quiet_hours',
  stockline_default_landing: 'ember_default_landing',
  stockline_alert_sound: 'ember_alert_sound',
  stockline_portfolios_v3: 'ember_portfolios_v3',
}
const FLAG = 'ember_migration_v1_done'

function run() {
  try {
    if (localStorage.getItem(FLAG) === '1') return
    for (const [oldKey, newKey] of Object.entries(KEY_MAP)) {
      const v = localStorage.getItem(oldKey)
      if (v == null) continue
      // Don't clobber a value the user already wrote post-migration.
      if (localStorage.getItem(newKey) == null) localStorage.setItem(newKey, v)
      localStorage.removeItem(oldKey)
    }
    localStorage.setItem(FLAG, '1')
  } catch {
    // Private-browsing or storage-disabled environments: nothing to migrate.
  }
}

run()

export {}
