import { Plugin, MarkdownView, PluginSettingTab, Setting, App, WorkspaceLeaf } from 'obsidian';


interface AutoScrollToFirstHeaderPluginSettings {
	scrollDelayMs: number;
	enableAdjustPaddingForNonScrollable: boolean;
}

const DEFAULT_SETTINGS: AutoScrollToFirstHeaderPluginSettings = {
	scrollDelayMs: 100,
	enableAdjustPaddingForNonScrollable: false,
};

class AutoScrollToFirstHeaderSettingTab extends PluginSettingTab {
	constructor(public app: App, public plugin: AutoScrollToFirstHeaderPlugin) {
		super(app, plugin);
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

		new Setting(containerEl)
			.setName('Enable auto-scroll even for non-scrollable content')
			.setDesc('If checked, auto-scroll will be triggered even when the content does not require vertical scrolling.')
			.addToggle(toggle => {
				toggle
					.setValue(this.plugin.settings.enableAdjustPaddingForNonScrollable)
					.onChange(async (value) => {
						this.plugin.settings.enableAdjustPaddingForNonScrollable = value;
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
			this.app.workspace.on('file-open', () => this.handleFileOpen())
		);
		this.app.workspace.onLayoutReady(() => this.handleFileOpen());
	}

	private handleFileOpen() {
		const leaf = this.getActiveMarkdownLeaf();
		if (!leaf) return;
		const view = leaf.view as MarkdownView;
		const editor = view.editor;
		if (!editor) return;

		setTimeout(() => {
			if (this.isFlashing()) return;
			if (this.settings.enableAdjustPaddingForNonScrollable) {
				this.adjustPadding(view);
			}
			this.scrollToFirstHeader(view);
		}, this.settings.scrollDelayMs);
	}

	private getActiveMarkdownLeaf(): WorkspaceLeaf | null {
		const leaf = this.app.workspace.activeLeaf;
		if (!leaf) return null;
		if (!(leaf.view instanceof MarkdownView)) return null;
		return leaf;
	}

	private isFlashing(): boolean {
		return !!this.app.workspace.containerEl.querySelector('span.is-flashing');
	}

	private adjustPadding(view: MarkdownView) {
		const cmContent = view.containerEl.querySelector('.cm-content.cm-lineWrapping') as HTMLElement | null;
		if (cmContent?.parentElement) {
			const visibleHeight = cmContent.parentElement.clientHeight;
			cmContent.style.paddingBottom = `${visibleHeight}px`;
		}
	}

	private scrollToFirstHeader(view: MarkdownView) {
		const mode = typeof view.getMode === 'function' ? view.getMode() : (view as { mode?: string }).mode;
		if (mode === 'source' || mode === 'live') {
			this.scrollEditorToFirstHeader(view);
		} else if (mode === 'preview') {
			this.scrollPreviewToFirstHeader(view);
		}
	}

	private scrollEditorToFirstHeader(view: MarkdownView) {
		const editor = view.editor;
		const lineCount = editor.lineCount();
		for (let i = 0; i < lineCount; i++) {
			const line = editor.getLine(i);
			if (/^\s*#+\s+/.test(line)) {
				editor.setCursor({ line: i, ch: 0 });
				this.scrollEditorLineIntoView(view, i);
				break;
			}
		}
	}

	private scrollEditorLineIntoView(view: MarkdownView, lineNumber: number) {
		const editorEl = typeof (view.editor as any).getWrapperElement === 'function'
			? (view.editor as any).getWrapperElement()
			: view.containerEl;
		if (editorEl) {
			const lines = editorEl.querySelectorAll('.cm-line');
			if (lines && lines[lineNumber]) {
				(lines[lineNumber] as HTMLElement).scrollIntoView({ block: 'start', behavior: 'auto' });
			}
		}
	}

	private scrollPreviewToFirstHeader(view: MarkdownView) {
		const container = (view as any).previewMode?.containerEl || view.containerEl;
		if (!container) return;
		const header = container.querySelector('.markdown-preview-view h1, .markdown-preview-view h2, .markdown-preview-view h3, .markdown-preview-view h4, .markdown-preview-view h5, .markdown-preview-view h6');
		if (header && (header as HTMLElement).scrollIntoView) {
			(header as HTMLElement).scrollIntoView({ block: 'start', behavior: 'auto' });
		}
	}
}
