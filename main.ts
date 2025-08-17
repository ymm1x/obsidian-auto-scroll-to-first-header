import { Plugin, MarkdownView, PluginSettingTab, Setting, App, WorkspaceLeaf } from 'obsidian';


interface AutoScrollToFirstHeaderPluginSettings {
	scrollDelayMs: number;
	enableAdjustPaddingForNonScrollable: boolean;
	moveCursorToFirstHeader: boolean;
	enableSmoothScroll: boolean;
}

const DEFAULT_SETTINGS: AutoScrollToFirstHeaderPluginSettings = {
	scrollDelayMs: 100,
	enableAdjustPaddingForNonScrollable: false,
	moveCursorToFirstHeader: true,
	enableSmoothScroll: false,
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
			.setDesc('If checked, auto-scroll will be triggered even when the content does not require vertical scrolling.\nAs a side effect, you will be able to scroll beyond the last line.')
			.addToggle(toggle => {
				toggle
					.setValue(this.plugin.settings.enableAdjustPaddingForNonScrollable)
					.onChange(async (value) => {
						this.plugin.settings.enableAdjustPaddingForNonScrollable = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('Move cursor to the first header line automatically')
			.setDesc('If checked, the cursor will be moved to the first header line when a file is opened.')
			.addToggle(toggle => {
				toggle
					.setValue(this.plugin.settings.moveCursorToFirstHeader)
					.onChange(async (value) => {
						this.plugin.settings.moveCursorToFirstHeader = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('Enable smooth scroll animation')
			.setDesc('If checked, scrolling to the first header will be animated smoothly.')
			.addToggle(toggle => {
				toggle
					.setValue(this.plugin.settings.enableSmoothScroll)
					.onChange(async (value) => {
						this.plugin.settings.enableSmoothScroll = value;
						await this.plugin.saveSettings();
					});
			});
	}
}

export default class AutoScrollToFirstHeaderPlugin extends Plugin {
	settings!: AutoScrollToFirstHeaderPluginSettings;

	private findFirstHeaderLine(editorEl: HTMLElement): number | null {
		const headerLines = editorEl.querySelectorAll('.cm-line.HyperMD-header');
		if (headerLines.length > 0) { // is live preview
			const allLines = editorEl.querySelectorAll('.cm-line');
			for (let i = 0; i < allLines.length; i++) {
				if (allLines[i] === headerLines[0]) {
					return i;
				}
			}
		}
		// is not live preview or no header lines found
		const lines = editorEl.querySelectorAll('.cm-line');
		for (let i = 0; i < lines.length; i++) {
			const text = lines[i].textContent ?? "";
			if (/^\s*#+\s+/.test(text)) {
				return i;
			}
		}
		return null;
	}

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
		if (!leaf) {
			return;
		}
		const view = leaf.view as MarkdownView;
		const editor = view.editor;
		if (!editor) {
			return;
		}

		setTimeout(() => {
			if (this.isFlashing()) {
				return;
			}
			if (this.settings.enableAdjustPaddingForNonScrollable) {
				this.adjustPadding(view);
			}
			this.scrollToFirstHeader(view);
		}, this.settings.scrollDelayMs);
	}

	private getActiveMarkdownLeaf(): WorkspaceLeaf | null {
		const leaf = this.app.workspace.activeLeaf;
		if (!leaf) {
			return null;
		}
		if (!(leaf.view instanceof MarkdownView)) {
			return null;
		}
		return leaf;
	}

	private isFlashing(): boolean {
		return !!this.app.workspace.containerEl.querySelector('span.is-flashing');
	}

	private adjustPadding(view: MarkdownView) {
		try {
			const cmContent = view.containerEl.querySelector('.cm-content.cm-lineWrapping') as HTMLElement | null;
			if (cmContent && cmContent.parentElement) {
				const visibleHeight = cmContent.parentElement.clientHeight;
				cmContent.style.paddingBottom = `${visibleHeight}px`;
			} else {
				console.warn('cm-content.cm-lineWrapping not found or has no parentElement');
			}
		} catch (e) {
			console.error('adjustPadding error:', e);
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
		const editorEl = typeof (editor as any).getWrapperElement === 'function'
			? (editor as any).getWrapperElement()
			: view.containerEl;
		const headerLine = this.findFirstHeaderLine(editorEl);
		if (headerLine !== null) {
			if (this.settings.moveCursorToFirstHeader) {
				editor.setCursor({ line: headerLine, ch: 0 });
			}
			this.scrollEditorLineIntoView(view, headerLine);
		}
	}

	private scrollEditorLineIntoView(view: MarkdownView, lineNumber: number) {
		try {
			const editorEl = typeof (view.editor as any).getWrapperElement === 'function'
				? (view.editor as any).getWrapperElement()
				: view.containerEl;
			if (editorEl) {
				const lines = editorEl.querySelectorAll('.cm-line');
				if (lines && lines[lineNumber]) {
					const target = lines[lineNumber] as HTMLElement;
					if (this.settings.enableSmoothScroll) {
						const scroller = editorEl.querySelector('.cm-scroller') as HTMLElement;
						if (scroller) {
							const targetRect = target.getBoundingClientRect();
							const scrollerRect = scroller.getBoundingClientRect();
							const offset = targetRect.top - scrollerRect.top + scroller.scrollTop;
							scroller.scrollTo({ top: offset, behavior: 'smooth' });
						} else {
							// fallback
							target.scrollIntoView({ block: 'start', behavior: 'smooth' });
						}
					} else {
						target.scrollIntoView({ block: 'start', behavior: 'auto' });
					}
				}
			}
		} catch (e) {
			console.error('scrollEditorLineIntoView error:', e);
		}
	}

	private scrollPreviewToFirstHeader(view: MarkdownView) {
		try {
			const container = (view as any).previewMode?.containerEl || view.containerEl;
			if (!container) {
				return;
			}
			const header = container.querySelector('.markdown-preview-view h1, .markdown-preview-view h2, .markdown-preview-view h3, .markdown-preview-view h4, .markdown-preview-view h5, .markdown-preview-view h6');
			if (header && (header as HTMLElement).scrollIntoView) {
				(header as HTMLElement).scrollIntoView({
					block: 'start',
					behavior: this.settings.enableSmoothScroll ? 'smooth' : 'auto',
				});
			} else {
				const editor = view.editor;
				const editorEl = typeof (editor as any).getWrapperElement === 'function'
					? (editor as any).getWrapperElement()
					: view.containerEl;
				const headerLine = this.findFirstHeaderLine(editorEl);
				if (headerLine !== null) {
					const lineElements = container.querySelectorAll('.markdown-preview-view .cm-line');
					if (lineElements && lineElements[headerLine]) {
						(lineElements[headerLine] as HTMLElement).scrollIntoView({
							block: 'start',
							behavior: this.settings.enableSmoothScroll ? 'smooth' : 'auto',
						});
					}
				}
			}
		} catch (e) {
			console.error('scrollPreviewToFirstHeader error:', e);
		}
	}
}
