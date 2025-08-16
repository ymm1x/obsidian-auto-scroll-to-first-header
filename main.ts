import { Plugin, MarkdownView, PluginSettingTab, Setting, App } from 'obsidian';

interface AutoScrollToFirstHeaderPluginSettings {
	scrollDelayMs: number;
}

const DEFAULT_SETTINGS: AutoScrollToFirstHeaderPluginSettings = {
	scrollDelayMs: 100,
};

class AutoScrollToFirstHeaderSettingTab extends PluginSettingTab {
	plugin: AutoScrollToFirstHeaderPlugin;

	constructor(app: App, plugin: AutoScrollToFirstHeaderPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Auto Scroll To First Header Settings' });

		new Setting(containerEl)
			.setName('Scroll delay (ms)')
			.setDesc('Delay in milliseconds before scrolling to the first header when a file is opened.')
			.addSlider(slider => {
				slider
					.setLimits(0, 2000, 10)
					.setValue(this.plugin.settings.scrollDelayMs)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.scrollDelayMs = value;
						await this.plugin.saveSettings();
					});
			});
	}
}

export default class AutoScrollToFirstHeaderPlugin extends Plugin {
	settings!: AutoScrollToFirstHeaderPluginSettings;

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new AutoScrollToFirstHeaderSettingTab(this.app, this));
		this.registerEvent(
			this.app.workspace.on('file-open', () => {
				this.waitForCursorAtTopAndScroll();
			})
		);
		this.app.workspace.onLayoutReady(() => {
			this.waitForCursorAtTopAndScroll();
		});
	}

	waitForCursorAtTopAndScroll() {
		const leaf = this.app.workspace.activeLeaf;
		if (!leaf) return;
		const view = leaf.view;
		if (!(view instanceof MarkdownView)) return;
		const editor = view.editor;
		if (!editor) return;

		setTimeout(() => {
			const containsFlashingSpan = this.app.workspace.containerEl.querySelector('span.is-flashing');
			if (containsFlashingSpan) return;
			const cmContent = view.containerEl.querySelector('.cm-content.cm-lineWrapping') as HTMLElement | null;
			if (cmContent?.parentElement) {
				const visibleHeight = cmContent.parentElement.clientHeight;
				cmContent.style.paddingBottom = `${visibleHeight}px`;
			}
			this.scrollToFirstHeader();
		}, this.settings.scrollDelayMs);
	}

	async scrollToFirstHeader() {
		const leaf = this.app.workspace.activeLeaf;
		if (!leaf) return;
		const view = leaf.view;
		if (!(view instanceof MarkdownView)) return;

		const mode = typeof view.getMode === 'function' ? view.getMode() : (view as { mode?: string }).mode;
		if (mode === 'source' || mode === 'live') {
			const lineCount = view.editor.lineCount();
			let headerLine = -1;
			for (let i = 0; i < lineCount; i++) {
				const line = view.editor.getLine(i);
				if (/^\s*#+\s+/.test(line)) {
					headerLine = i;
					break;
				}
			}
			if (headerLine >= 0) {
				view.editor.setCursor({ line: headerLine, ch: 0 });
				const editorEl = typeof (view.editor as any).getWrapperElement === 'function'
					? (view.editor as any).getWrapperElement()
					: view.containerEl;
				if (editorEl) {
					const lines = editorEl.querySelectorAll('.cm-line');
					if (lines && lines[headerLine]) {
						lines[headerLine].scrollIntoView({ block: 'start', behavior: 'auto' });
					}
				}
			}
		} else if (mode === 'preview') {
			const container = (view as any).previewMode?.containerEl || view.containerEl;
			if (!container) return;
			const header = container.querySelector('.markdown-preview-view h1, .markdown-preview-view h2, .markdown-preview-view h3, .markdown-preview-view h4, .markdown-preview-view h5, .markdown-preview-view h6');
			if (header && header.scrollIntoView) {
				header.scrollIntoView({ block: 'start', behavior: 'auto' });
			}
		}
	}
}
