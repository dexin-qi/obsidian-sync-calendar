# Obsidian x Calendar Plugin

[中文](./docs/README.zh-Ch.md)

An [Obsidian](https://obsidian.md/) plugin that synchronizes events from the calendar and manages them like tasks.


![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/dustinksi/obsidian-sync-calendar/release.yml?style=shield) ![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/dustinksi/obsidian-sync-calendar?display_name=tag)


**Note**: 
1. Our task format is borrowed from tasks, but we **do not support recurring tasks** at the moment.
2. To sync tasks from Obsidian to the calendar, you need to attach a start time element to the task (i.e. 🛫 YYYY-MM-DD), then click the sync icon or call the `Sync with Calendar` command.
3. Our task synchronization is **centered around calendar events**, which means that after syncing tasks from Obsidian to the calendar, modifications to tasks in Obsidian will not be synced to the calendar. To further modify the schedule, you need to modify it directly in the calendar. The changes made in the calendar will be automatically synced back to Obsidian later.
4. This plugin is still in early alpha and is subject to change at any time!


![RELEASE DEMO](./docs/README_DEMO.gif)


## Installation & Usage

### First of All

- You need a Google Calendar credentials file. You can apply for it yourself:
    - Refer [create project guide](https://developers.google.com/workspace/guides/create-project) to create a Google Cloud Project
    - Refer [enable apis guide](https://developers.google.com/workspace/guides/enable-apis) to enable your Google Calendar's API.
    - [Configure OA Screen](https://console.cloud.google.com/apis/credentials/consent?)
    - [Prepare to get your OA credentials](https://console.cloud.google.com/apis/credentials/oauthclient)
      - Select "Desktop Application"
      - Input a name for this OA Application.
      - Download the OAClient credentials file.
- Place the credentials file in `VaultFolder/.obsidian/calendar.sync.credentials.json`

### Manually installing the plugin

- Download `main.js`, `styles.css`, `manifest.json` from the [release page](https://github.com/dustinksi/obsidian-sync-calendar/releases).
- Copy the downloaded files to `VaultFolder/.obsidian/plugins/your-plugin-id/`.

**Note**: You can also compile this plugin yourself:
- Clone this repo.
- Run `npm i` or `yarn` to install dependencies.
- Run `npm run dev` to start compilation in watch mode.


### ~~From Obsidian Community Plugins Broswer (Not Avaliable for now.)~~
- ~~Install the plugin through the Obsidian's community plugins browser.~~
- ~~Enable the plugin in Obsidian.~~

### Use this Plugin
- Place a code block like the following in any note:
   ````markdown
   ```sync-calendar
   name: "{numberTodo} todos @ Apr. 21",
   timeMin: "2023-04-21"
   timeMax: "2023-04-22"
   ```
   ````
- Swap to preview mode and the plugin should replace this code block with the materialized result.

> If you are synchronizing your vault, I recommend explicitly ignoring the `VaultFolder/.obsidian/calendar.sync.token.json` file for security reasons, if possible.

## Inputs
| Name |  Type | Description | Default |
| ------------- | ---- | -------- | ------- |
| `name`        | string        | The title for the query. You can use the `{numberTodos}` template which will be replaced by the number of todos returned by the query.        | {numberTodos} todos in calendar         |
| `timeMin`      |      string   | A string that conforms to moment.js, the minimum time (including `timeMin`) for events.     |      One week before the current time   |
| `timeMax` |      string    |  A string that conforms to moment.js, the maximum time (excluding `timeMax`) for events.   | null    |

**Note**: `sort`, `filter`，`group` are features which will be released in next version. Welcome to contribute!

## Command

Currently, only one command is supported, which is used to manually trigger the synchronization of tasks from Obsidian to Calendar.

`Sync with Calendar`:

   This command will fetch tasks with a startDate (i.e. 🛫 YYYY-MM-DD) in Obsidian.


## Thanks to  

The brilliant plugins:

[obsidian-todoist](https://github.com/jamiebrynes7/obsidian-todoist-plugin)

[obsidian-tasks](https://github.com/obsidian-tasks-group/obsidian-tasks) 

[obsidian-dataview](https://github.com/blacksmithgu/obsidian-dataview)

This plugin has borrowed a lot of valuable experience from the above plugins.

And I would also like to thank Wang Jiayu for accompanying me through the conception, design, and development of this plugin.


## Support

Have you found the obsidian-sync-calendar plugin helpful and want to support it? I accept donations that will go towards future development efforts. I generally do not accept payment for bug bounties/feature requests, as financial incentives add stress/expectations which I want to avoid for a hobby project!

<a href="https://www.buymeacoffee.com/dexin.qi"><img src="https://img.buymeacoffee.com/button-api/?text=Buy me a cocacola&emoji=🥤&slug=dexin.qi&button_colour=FF5F5F&font_colour=ffffff&font_family=Cookie&outline_colour=000000&coffee_colour=FFDD00" /></a> 
