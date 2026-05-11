# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.8.0] - 2026-05-11

### Added

- **Progress Visualization in HomePage**: Daily view and weekly report now display progress bars with color-coded status indicators (green/orange/red) next to each task name, showing estimated time vs logged time
- **Reports Page Enhancements**: New "Est. Time" and "Progress" columns in "By Task" tab with status badges ("On time", "Margin Xh Xm", "+Xh Xm overtime")
- **WorkTimeForm Progress Tooltip**: When selecting a task in the combobox, a colored badge shows "Progress: Xh Xm / Xh Xm (X%) — Margin: Xh Xm" to help decide time registration
- **TimeLogsTable Progress Indicators**: Color dots (green/orange/red) next to task names indicating accumulated progress status at the time of each entry
- **Progress Utilities Module**: Shared `progressUtils.ts` with `getTaskProgressInfo()`, `getStatusBarColor()`, and `formatMinutesToHHMM()` for consistent progress calculations across the app

### Changed

- **Combobox Component**: Extended with `showProgress` prop to display color indicators for tasks with estimated time
- **Weekly Report in HomePage**: Now shows individual task progress against estimated time rather than proportion of weekly total
- **Daily View in HomePage**: Progress bars now compare against task estimated time instead of daily max hours

### Translated

- New i18n keys: `colEstimated`, `colProgress`, `onTime`, `margin`, `progressInfo` in both English and Spanish

## [1.7.0] - 2026-05-11

### Added

- **Weekly Report Section**: Summary of time logged in the last 7 days with task breakdown
- **Estimated Time Field**: Tasks now support an estimated time field (HH:MM format) with inline editing in the Tasks table
- **Progress Column**: Visual progress bar in Tasks table showing logged vs estimated time with color-coded status
- **Draft Persistence**: WorkTimeForm drafts are now saved to SQLite with autosave recovery
- **Single Instance Lock**: Desktop app now enforces single instance to prevent duplicate windows

### Changed

- **Task Search**: Enhanced to search by task name and task link
- **Reports Page**: Added task search/filter functionality

### Fixed

- **Combobox Focus**: Improved focus behavior when dropdown opens
- **WorkTime startTime/endTime**: Proper handling for afterLunch toggle cascade effects
- **TypeScript**: Normalized input casing and encryption mock typing

### Refactored

- Migrated from `@/` path aliases to relative imports for consistency
- Updated TypeScript config with `esModuleInterop` enabled

## [1.6.0] - 2026-04-2026

### Added

- **AI Agents Skills**: Framework for AI-assisted development with specialized skills
- **Sticky Navbar**: Navigation bar with back-to-top action
- **Task Link Duplicates Handling**: Detect and handle duplicate TW task links on import

### Changed

- **Task Import**: Improved robustness for handling task duplicates

## [1.5.0] - 2026-04-2026

### Added

- **i18n Support**: Full English and Spanish translations
- **Settings Page**: Complete settings management with work schedule, holidays sync, and comment templates
- **Pull from TeamWork**: Import time entries directly from TeamWork API
- **CSV Task Import**: Import tasks from CSV files with auto-type creation

## [1.4.0] - 2026-03-2026

### Added

- **Tasks Page**: Full task management with types, estimated times, and progress tracking
- **TimeLogs Page**: Tabular view of all time entries with edit, duplicate, delete, and sync actions

### Changed

- **Navigation**: Reorganized with separate Tasks page and TimeLogs tab

## [1.3.0] - 2026-03-2026

### Added

- **WorkTimeForm**: Time entry form with timer support, drag-to-reorder entries, and smart slot suggestions
- **Keyboard Shortcuts**: Ctrl+N (new entry), Ctrl+S (save), Esc (remove last entry)

### Changed

- **Daily Time Info**: Better calculation of available slots and remaining time

## [1.2.0] - 2026-02-2026

### Added

- **TeamWork Sync**: Bidirectional sync with TeamWork API (send/receive time entries)
- **Task Comments**: Post comments to TeamWork tasks directly from the app

### Changed

- **Authentication**: TeamWork API credentials stored securely with electron-store encryption

## [1.1.0] - 2026-02-2026

### Added

- **Reports Page**: Time reports by task and by day with filters
- **Summary Cards**: Quick stats dashboard on home page

## [1.0.0] - 2026-01-2026

### Added

- Initial release with basic time tracking and TeamWork integration