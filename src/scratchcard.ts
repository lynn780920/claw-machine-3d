import { soundEngine } from './audio';

export class ScratchcardManager {
  private scratchChances: number = 0;
  private prizeGrid: string[] = []; // 50 items: 'A', 'B', 'C', or 'MISSED'
  private revealedGrid: boolean[] = []; // 50 booleans
  private modalEl: HTMLElement | null = null;
  private countEl: HTMLElement | null = null;

  constructor() {
    this.initPrizes();
  }

  // Generate 50 spots with 3 hidden prizes (A, B, C)
  public initPrizes() {
    this.prizeGrid = new Array(50).fill('銘謝惠顧');
    this.revealedGrid = new Array(50).fill(false);

    // Pick 3 unique random indices out of 50
    const indices: number[] = [];
    while (indices.length < 3) {
      const rand = Math.floor(Math.random() * 50);
      if (!indices.includes(rand)) {
        indices.push(rand);
      }
    }

    this.prizeGrid[indices[0]] = '🏆 A 獎 (特獎)';
    this.prizeGrid[indices[1]] = '🥇 B 獎 (頭獎)';
    this.prizeGrid[indices[2]] = '🥈 C 獎 (二獎)';
  }

  public addChance(amount = 1) {
    this.scratchChances += amount;
    this.updateUI();
  }

  public getChances(): number {
    return this.scratchChances;
  }

  public openModal() {
    if (!this.modalEl) {
      this.buildModalDOM();
    }
    if (this.modalEl) {
      this.modalEl.style.display = 'flex';
      this.renderGrid();
      this.updateUI();
    }
  }

  public closeModal() {
    if (this.modalEl) {
      this.modalEl.style.display = 'none';
    }
  }

  private updateUI() {
    if (this.countEl) {
      this.countEl.textContent = this.scratchChances.toString();
    }
    const chanceBadge = document.getElementById('scratch-chance-badge');
    if (chanceBadge) {
      chanceBadge.textContent = `🎟️ 剩餘刮刮卡次數: ${this.scratchChances}`;
    }
  }

  private buildModalDOM() {
    const modal = document.createElement('div');
    modal.id = 'scratch-modal';
    modal.className = 'scratch-modal-overlay';
    modal.innerHTML = `
      <div class="scratch-card-container">
        <!-- Header Banner matching Screenshot 2 -->
        <div class="scratch-header">
          <div class="scratch-header-top">
            <div class="scratch-title-box">
              <span class="gold-badge">金好刮</span>
              <span class="gold-english">GOLDGOOD</span>
            </div>
            <div class="scratch-chances-box">
              <span>可刮次數: <strong id="scratch-chances-val">0</strong> 次</span>
              <button class="close-scratch-btn" id="close-scratch-btn">✕</button>
            </div>
          </div>
          <div class="scratch-rules-box">
            <div class="rules-title">加贈活動說明：</div>
            <div class="rules-desc">• 夾取商品掉進洞口後獲得 1 次刮刮卡資格。盤面包含 50 個刮孔，隱藏 A 獎、B 獎、C 獎 3 大大獎！</div>
          </div>
        </div>

        <!-- 5x10 Scratch Grid -->
        <div class="scratch-grid" id="scratch-grid"></div>

        <!-- Footer Action Buttons: Large Primary Close Button -->
        <div class="scratch-footer">
          <button class="close-scratch-footer-btn" id="close-scratch-footer-btn">✖ 關閉刮刮樂視窗</button>
          <button class="reset-scratch-btn" id="reset-scratch-btn">🔄 重置 50 刮盤面</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.modalEl = modal;
    this.countEl = modal.querySelector('#scratch-chances-val');

    const doClose = () => this.closeModal();
    modal.querySelector('#close-scratch-btn')?.addEventListener('click', doClose);
    modal.querySelector('#close-scratch-footer-btn')?.addEventListener('click', doClose);

    modal.querySelector('#reset-scratch-btn')?.addEventListener('click', () => {
      if (confirm('確定要清空並重置 50 刮刮卡盤面嗎？')) {
        this.initPrizes();
        this.renderGrid();
      }
    });
  }

  private renderGrid() {
    const gridEl = this.modalEl?.querySelector('#scratch-grid');
    if (!gridEl) return;
    gridEl.innerHTML = '';

    for (let i = 0; i < 50; i++) {
      const spot = document.createElement('div');
      spot.className = 'scratch-spot';

      // Revealed Prize Content beneath foil
      const prizeContent = document.createElement('div');
      prizeContent.className = 'prize-content';
      const prizeVal = this.prizeGrid[i];
      prizeContent.textContent = prizeVal;
      if (prizeVal.includes('獎')) {
        prizeContent.classList.add('win-prize');
      }

      // Canvas Foil Overlay (Dark Circle)
      const canvas = document.createElement('canvas');
      canvas.width = 70;
      canvas.height = 70;
      const ctx = canvas.getContext('2d')!;

      // Draw dark foil circle
      this.drawFoil(ctx, this.revealedGrid[i]);

      spot.appendChild(prizeContent);
      spot.appendChild(canvas);
      gridEl.appendChild(spot);

      // Scratching logic with touch & mouse
      let isScratching = false;

      const scratchPoint = (x: number, y: number) => {
        if (this.scratchChances <= 0 && !this.revealedGrid[i]) {
          alert('🎟️ 刮刮卡次數已用完！請繼續夾娃娃獲得刮刮卡資格！');
          return;
        }

        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(x, y, 16, 0, Math.PI * 2);
        ctx.fill();
        soundEngine.playScratchSFX();

        if (!this.revealedGrid[i]) {
          this.revealedGrid[i] = true;
          this.scratchChances = Math.max(0, this.scratchChances - 1);
          this.updateUI();

          if (prizeVal.includes('獎')) {
            soundEngine.playWinSFX();
            setTimeout(() => {
              alert(`🎉 恭喜刮中【${prizeVal}】大獎！大吉大利！🏆`);
            }, 300);
          }
        }
      };

      canvas.addEventListener('mousedown', (e) => {
        isScratching = true;
        const rect = canvas.getBoundingClientRect();
        scratchPoint(e.clientX - rect.left, e.clientY - rect.top);
      });

      canvas.addEventListener('mousemove', (e) => {
        if (isScratching) {
          const rect = canvas.getBoundingClientRect();
          scratchPoint(e.clientX - rect.left, e.clientY - rect.top);
        }
      });

      window.addEventListener('mouseup', () => { isScratching = false; });

      canvas.addEventListener('touchstart', (e) => {
        isScratching = true;
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        scratchPoint(touch.clientX - rect.left, touch.clientY - rect.top);
      });

      canvas.addEventListener('touchmove', (e) => {
        if (isScratching) {
          const rect = canvas.getBoundingClientRect();
          const touch = e.touches[0];
          scratchPoint(touch.clientX - rect.left, touch.clientY - rect.top);
        }
      });

      canvas.addEventListener('touchend', () => { isScratching = false; });
    }
  }

  private drawFoil(ctx: CanvasRenderingContext2D, isAlreadyRevealed: boolean) {
    if (isAlreadyRevealed) {
      ctx.clearRect(0, 0, 70, 70);
      return;
    }

    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(35, 35, 32, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('刮開', 35, 39);
  }
}

export const scratchcardManager = new ScratchcardManager();
