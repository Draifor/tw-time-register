const en = {
  translations: {
    common: {
      selectLanguage: 'Select Language',
      cancel: 'Cancel',
      save: 'Save',
      saving: 'Saving...',
      delete: 'Delete',
      add: 'Add',
      import: 'Import',
      export: 'Export',
      date: 'Date',
      description: 'Description',
      entries: 'entries',
      noTask: 'No task',
      system: 'System',
      sent: 'Sent',
      pending: 'Pending',
      billable: 'Billable',
      noData: 'No data'
    },
    timeLogs: {
      deleteSuccess: 'Entry "{{name}}" deleted',
      deleteError: 'Failed to delete entry',
      saveError: 'Failed to save changes',
      changesSaved: 'Changes saved',
      updatedPending: 'Entry updated and marked as pending — sync it again to update TW',
      noTaskLink: 'No task_link for "{{name}}"',
      noTWTaskId: 'Could not extract TW task ID from URL: {{url}}',
      durationZero: 'Duration is 0 — check start/end time',
      syncFailed: 'Sync failed',
      entrySentToTW: '✓ "{{name}}" sent to TW',
      noPending: 'No pending entries',
      allSent: '{{count}} entries sent to TeamWork',
      partialSent: '{{success}} sent, {{fail}} failed',
      noTimeLogs: 'No time logs yet',
      createEntry: 'Create an entry on the home screen',
      searchPlaceholder: 'Search by task or description...',
      filters: 'Filters',
      allTasks: 'All tasks',
      searchTask: 'Search task...',
      of: 'of',
      colStart: 'Start',
      colEnd: 'End',
      colDuration: 'Duration',
      colStatus: 'Status',
      colActions: 'Actions',
      noFilterResults: 'No results match the active filters',
      saveChanges: 'Save changes',
      deleteEntry: 'Delete entry',
      deleteConfirmTitle: 'Delete this entry?',
      deleteConfirmDesc: 'This action cannot be undone. The entry will be removed locally only.',
      yes: 'Yes',
      editResync: 'Edit & re-sync to TW',
      editEntry: 'Edit entry',
      sendToTW: 'Send to TeamWork'
    },
    nav: {
      home: 'Home',
      workTime: 'Work Time',
      tasks: 'Tasks',
      reports: 'Reports',
      settings: 'Settings',
      noSession: 'No TW session',
      verifying: 'Verifying credentials...',
      connectedAs: 'Connected as {{username}} · {{domain}}.teamwork.com',
      noCredentials: 'No TeamWork credentials. Click to configure.',
      installing: 'Install',
      updating: 'Updating',
      downloadedVersion: 'v{{version}} downloaded. Click to install and restart.',
      downloadingVersion: 'Downloading v{{version}}...'
    },
    home: {
      title: 'Welcome to TW Time Register',
      subtitle: 'Track your work hours and sync them with TeamWork effortlessly.',
      timeRegistration: 'Time Registration',
      timeRegistrationDesc: 'Register your daily work hours with automatic calculations for end times.',
      startRegistering: 'Start Registering',
      taskManagement: 'Task Management',
      taskManagementDesc: 'Manage your TeamWork tasks and task types for quick time entry selection.',
      viewTasks: 'View Tasks',
      quickStats: 'Quick Stats',
      statsSummary: 'Your time tracking summary',
      today: 'Today',
      thisWeek: 'This Week',
      pendingEntries: 'Pending Entries'
    },
    reports: {
      title: 'Reports',
      subtitle: 'Summary of hours by task and by day',
      from: 'From',
      to: 'To',
      clear: 'Clear',
      noData: 'No data in the selected range',
      totalLogged: 'Total logged',
      sentToTW: 'Sent to TW',
      ofTotal: 'of total',
      daysWithLogs: 'Days with logs',
      avgDay: 'avg/day',
      byTask: 'By task',
      byDay: 'By day',
      colTask: 'Task',
      colEntries: 'Entries',
      colTotalHours: 'Total hours',
      colBillable: 'Billable',
      colSyncStatus: 'Sync status',
      colDate: 'Date'
    },
    settings: {
      title: 'Settings',
      subtitle: 'Configure your work schedule and holidays',
      saved: 'Settings saved',
      saveError: 'Error saving settings',
      language: {
        title: 'Language',
        description: 'Select the interface language'
      },
      teamwork: {
        description: 'Configure your API credentials to sync time entries',
        domain: 'TeamWork Domain',
        username: 'Username / Email',
        password: 'Password',
        userId: 'TW User ID',
        userIdHint: '(auto-filled when testing connection)',
        connectedAs: 'Connected as {{name}}',
        testConnection: 'Test connection',
        connectionFailed: 'Connection failed',
        savedCreds: 'TeamWork credentials saved',
        saveCredsError: 'Error saving credentials',
        testSuccess: 'Connected successfully. Hello, {{name}}!'
      },
      schedule: {
        title: 'Work Schedule',
        description: 'Define your start time and maximum hours per day',
        defaultStartTime: 'Default start time',
        maxHours: 'Maximum hours per day'
      },
      workDays: {
        title: 'Work Days',
        description: 'Select the days you work'
      },
      saveSettings: 'Save Settings',
      holidays: {
        title: 'Holidays',
        description: 'Holidays are not counted as work days',
        noHolidays: 'No holidays registered',
        holidayName: 'Holiday name',
        deleteTitle: 'Delete holiday?',
        deleteDescription: 'Are you sure you want to delete "{{name}}"?',
        added: 'Holiday added',
        addError: 'Error adding holiday',
        deleted: 'Holiday deleted',
        deleteError: 'Error deleting holiday',
        systemDeleteError: 'Cannot delete system holidays',
        fillAllFields: 'Please fill all fields'
      },
      database: {
        title: 'Database',
        description: 'Export your database as a backup or to transfer it to another installation',
        exportDb: 'Export DB',
        importDb: 'Import DB',
        importTitle: 'Import database?',
        importDescription:
          'This will completely replace your current database with the selected file. Current data will be lost. Continue?',
        importFootnote: 'The exported file contains all your tasks, types, time entries and settings.',
        exportSuccess: 'Database exported successfully',
        exportError: 'Export failed',
        importSuccess: 'Database imported. Restart the app to see the changes.',
        importError: 'Import failed'
      }
    },
    days: {
      monday: 'Monday',
      tuesday: 'Tuesday',
      wednesday: 'Wednesday',
      thursday: 'Thursday',
      friday: 'Friday',
      saturday: 'Saturday',
      sunday: 'Sunday'
    },
    menu: {
      file: {
        file: 'File',
        new: 'New',
        open: 'Open',
        save: 'Save',
        export: 'Export'
      },
      edit: {
        edit: 'Edit',
        undo: 'Undo',
        redo: 'Redo',
        cut: 'Cut',
        copy: 'Copy',
        paste: 'Paste'
      },
      view: {
        view: 'View',
        toggleDevTools: 'Toggle Dev Tools',
        zoomIn: 'Zoom +',
        zoomOut: 'Zoom -',
        fullscreen: 'Full Screen'
      },
      help: {
        help: 'Help',
        documentation: 'Documentation',
        about: 'About'
      }
    }
  }
};

export default en;
