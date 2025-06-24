const { createApp } = Vue;

createApp({
    data() {
        return {
            loading: true,
            busRoutes: [],
            gameMode: 'routeToNumber', // 'routeToNumber', 'numberToRoute', 'multipleChoice'
            currentQuestion: null,
            userAnswer: '',
            score: 0,
            correctAnswers: 0,
            wrongAnswers: 0,
            totalQuestions: 0,
            feedback: '',
            feedbackType: '',
            usedQuestions: [],
            // Çoktan seçmeli için
            multipleChoiceQuestion: {
                question: '',
                choices: [],
                correctAnswer: -1
            },
            selectedChoice: -1,
            answerSubmitted: false,
            // Animasyon kontrolü
            showPulse: false,
            showGlow: false
        };
    },
    computed: {
        successRate() {
            if (this.totalQuestions === 0) return 0;
            return Math.round((this.correctAnswers / this.totalQuestions) * 100);
        }
    },
    async mounted() {
        await this.loadBusRoutes();
        this.generateNewQuestion();
        this.loading = false;
        this.setupKeyboardShortcuts();
    },
    methods: {
        async loadBusRoutes() {
            try {
                const response = await fetch('eshot-otobus-hatlari.csv');
                const csvText = await response.text();
                this.busRoutes = this.parseCSV(csvText);
                console.log('Yüklenen hat sayısı:', this.busRoutes.length);
            } catch (error) {
                console.error('CSV yüklenirken hata:', error);
                this.feedback = 'Veriler yüklenirken bir hata oluştu!';
                this.feedbackType = 'wrong';
            }
        },
        
        parseCSV(csvText) {
            const lines = csvText.split('\n');
            const headers = lines[0].split(';');
            const routes = [];
            
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line) {
                    const values = line.split(';');
                    if (values.length >= 6) {
                        const route = {
                            HAT_NO: parseInt(values[0]) || 0,
                            HAT_ADI: values[1] || '',
                            GUZERGAH_ACIKLAMA: values[2] || '',
                            ACIKLAMA: values[3] || '',
                            HAT_BASLANGIC: values[4] || '',
                            HAT_BITIS: values[5] || ''
                        };
                        
                        // Geçerli verileri kontrol et
                        if (route.HAT_NO > 0 && route.HAT_ADI && route.HAT_BASLANGIC && route.HAT_BITIS) {
                            routes.push(route);
                        }
                    }
                }
            }
            
            return routes;
        },
        
        setGameMode(mode) {
            this.playSound('click');
            this.gameMode = mode;
            this.generateNewQuestion();
            this.clearFeedback();
        },
        
        generateNewQuestion() {
            if (this.busRoutes.length === 0) return;
            
            // Tüm sorular kullanıldıysa listeyi sıfırla
            if (this.usedQuestions.length >= this.busRoutes.length) {
                this.usedQuestions = [];
            }
            
            let randomRoute;
            let attempts = 0;
            
            // Daha önce kullanılmamış bir soru bul
            do {
                const randomIndex = Math.floor(Math.random() * this.busRoutes.length);
                randomRoute = this.busRoutes[randomIndex];
                attempts++;
            } while (this.usedQuestions.includes(randomRoute.HAT_NO) && attempts < 50);
            
            this.currentQuestion = randomRoute;
            this.usedQuestions.push(randomRoute.HAT_NO);
            this.userAnswer = '';
            this.selectedChoice = -1;
            this.answerSubmitted = false;
            this.clearFeedback();
            
            // Çoktan seçmeli sorular için
            if (this.gameMode === 'multipleChoice') {
                this.generateMultipleChoiceQuestion();
            }
            
            // Animasyonları başlat
            this.startAnimations();
            
            // Input'a odaklan
            this.$nextTick(() => {
                if (this.$refs.answerInput) {
                    this.$refs.answerInput.focus();
                }
            });
        },
        
        generateMultipleChoiceQuestion() {
            const types = ['routeToNumber', 'numberToRoute'];
            const questionType = types[Math.floor(Math.random() * types.length)];
            
            if (questionType === 'routeToNumber') {
                // Güzergahdan hat numarası tahmin et
                this.multipleChoiceQuestion.question = `Bu güzergah hangi hat numarasına ait?\n${this.currentQuestion.HAT_ADI}\n${this.currentQuestion.GUZERGAH_ACIKLAMA}`;
                
                // Doğru cevap
                const correctAnswer = this.currentQuestion.HAT_NO;
                
                // Yanlış seçenekler oluştur
                const wrongAnswers = this.generateWrongNumbers(correctAnswer);
                
                // Tüm seçenekleri karıştır
                const allChoices = [correctAnswer, ...wrongAnswers].sort(() => Math.random() - 0.5);
                
                this.multipleChoiceQuestion.choices = allChoices;
                this.multipleChoiceQuestion.correctAnswer = allChoices.indexOf(correctAnswer);
            } else {
                // Hat numarasından güzergah tahmin et
                this.multipleChoiceQuestion.question = `${this.currentQuestion.HAT_NO} numaralı hat hangi güzergaha sahip?`;
                
                // Doğru cevap
                const correctAnswer = this.currentQuestion.HAT_ADI;
                
                // Yanlış seçenekler oluştur
                const wrongAnswers = this.generateWrongRoutes(this.currentQuestion.HAT_NO);
                
                // Tüm seçenekleri karıştır
                const allChoices = [correctAnswer, ...wrongAnswers].sort(() => Math.random() - 0.5);
                
                this.multipleChoiceQuestion.choices = allChoices;
                this.multipleChoiceQuestion.correctAnswer = allChoices.indexOf(correctAnswer);
            }
        },
        
        generateWrongNumbers(correctNumber) {
            const wrongNumbers = [];
            const usedNumbers = new Set([correctNumber]);
            
            while (wrongNumbers.length < 3) {
                // Yakın sayılar üret
                const variation = Math.floor(Math.random() * 20) - 10; // -10 ile +10 arası
                let wrongNumber = correctNumber + variation;
                
                // Geçerli aralıkta olsun
                if (wrongNumber < 1) wrongNumber = Math.floor(Math.random() * 50) + 1;
                if (wrongNumber > 600) wrongNumber = Math.floor(Math.random() * 100) + 1;
                
                if (!usedNumbers.has(wrongNumber)) {
                    wrongNumbers.push(wrongNumber);
                    usedNumbers.add(wrongNumber);
                }
            }
            
            return wrongNumbers;
        },
        
        generateWrongRoutes(correctNumber) {
            const wrongRoutes = [];
            const availableRoutes = this.busRoutes.filter(route => route.HAT_NO !== correctNumber);
            
            for (let i = 0; i < 3 && i < availableRoutes.length; i++) {
                const randomIndex = Math.floor(Math.random() * availableRoutes.length);
                const wrongRoute = availableRoutes.splice(randomIndex, 1)[0];
                wrongRoutes.push(wrongRoute.HAT_ADI);
            }
            
            return wrongRoutes;
        },
        
        startAnimations() {
            this.showPulse = true;
            this.showGlow = true;
            
            setTimeout(() => {
                this.showPulse = false;
                this.showGlow = false;
            }, 3000);
        },
        
        submitAnswer() {
            if (this.gameMode === 'multipleChoice') {
                if (this.selectedChoice === -1) {
                    this.showFeedback('Lütfen bir seçenek belirtin!', 'wrong');
                    return;
                }
                this.checkMultipleChoiceAnswer();
                return;
            }
            
            if (!this.userAnswer.toString().trim()) {
                this.showFeedback('Lütfen bir cevap girin!', 'wrong');
                return;
            }
            
            this.totalQuestions++;
            let isCorrect = false;
            let correctAnswer = '';
            
            if (this.gameMode === 'routeToNumber') {
                // Güzergahdan hat numarası tahmin etme
                const userNumber = parseInt(this.userAnswer);
                const correctNumber = this.currentQuestion.HAT_NO;
                isCorrect = userNumber === correctNumber;
                correctAnswer = correctNumber.toString();
            } else {
                // Hat numarasından güzergah tahmin etme
                const userText = this.userAnswer.toLowerCase().trim();
                const routeTexts = [
                    this.currentQuestion.HAT_ADI,
                    this.currentQuestion.HAT_BASLANGIC,
                    this.currentQuestion.HAT_BITIS,
                    this.currentQuestion.GUZERGAH_ACIKLAMA
                ].filter(text => text).map(text => text.toLowerCase());
                
                // Kullanıcının cevabının doğru metinlerden biriyle eşleşip eşleşmediğini kontrol et
                isCorrect = routeTexts.some(text => 
                    text.includes(userText) || userText.includes(text) ||
                    this.calculateSimilarity(userText, text) > 0.7
                );
                
                correctAnswer = `${this.currentQuestion.HAT_ADI} (${this.currentQuestion.HAT_BASLANGIC} - ${this.currentQuestion.HAT_BITIS})`;
            }
            
            this.processAnswer(isCorrect, correctAnswer);
        },
        
        checkMultipleChoiceAnswer() {
            this.answerSubmitted = true;
            this.totalQuestions++;
            
            const isCorrect = this.selectedChoice === this.multipleChoiceQuestion.correctAnswer;
            const correctAnswer = this.multipleChoiceQuestion.choices[this.multipleChoiceQuestion.correctAnswer];
            
            this.processAnswer(isCorrect, correctAnswer);
        },
        
        processAnswer(isCorrect, correctAnswer) {
            if (isCorrect) {
                this.correctAnswers++;
                this.score += 10;
                this.showFeedback('🎉 Doğru! Tebrikler!', 'correct');
                this.playSound('correct');
                this.createConfetti();
                this.animateCorrect();
            } else {
                this.wrongAnswers++;
                this.showFeedback(`❌ Yanlış! Doğru cevap: ${correctAnswer}`, 'wrong');
                this.playSound('wrong');
                this.animateWrong();
            }
            
            // 2 saniye sonra yeni soru göster
            setTimeout(() => {
                this.generateNewQuestion();
            }, 2500);
        },
        
        selectChoice(index) {
            if (this.answerSubmitted) return;
            this.playSound('click');
            this.selectedChoice = index;
            
            // Hemen cevabı kontrol et
            setTimeout(() => {
                this.checkMultipleChoiceAnswer();
            }, 500);
        },
        
        getChoiceClass(index) {
            if (!this.answerSubmitted) {
                return this.selectedChoice === index ? 'selected' : '';
            }
            
            // Cevap verildi, doğru/yanlış göster
            if (index === this.multipleChoiceQuestion.correctAnswer) {
                return 'correct';
            } else if (index === this.selectedChoice && index !== this.multipleChoiceQuestion.correctAnswer) {
                return 'wrong';
            }
            
            return '';
        },
        
        playSound(type) {
            try {
                if (window.soundGenerator) {
                    if (type === 'correct') {
                        window.soundGenerator.playCorrectSound();
                    } else if (type === 'wrong') {
                        window.soundGenerator.playWrongSound();
                    } else if (type === 'click') {
                        window.soundGenerator.playClickSound();
                    }
                }
            } catch (e) {
                console.log('Ses çalınamadı:', e);
            }
        },
        
        createConfetti() {
            const container = document.getElementById('confetti-container');
            const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3'];
            
            for (let i = 0; i < 50; i++) {
                const confetti = document.createElement('div');
                confetti.className = 'confetti';
                confetti.style.left = Math.random() * 100 + 'vw';
                confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
                confetti.style.animationDelay = Math.random() * 3 + 's';
                confetti.style.animationDuration = (Math.random() * 3 + 2) + 's';
                
                container.appendChild(confetti);
                
                // Confetti'yi animasyon bittikten sonra temizle
                setTimeout(() => {
                    if (confetti.parentNode) {
                        confetti.parentNode.removeChild(confetti);
                    }
                }, 5000);
            }
        },
        
        animateCorrect() {
            const questionCard = document.querySelector('.question-card');
            if (questionCard) {
                questionCard.classList.add('correct-animation');
                setTimeout(() => {
                    questionCard.classList.remove('correct-animation');
                }, 600);
            }
        },
        
        animateWrong() {
            const questionCard = document.querySelector('.question-card');
            if (questionCard) {
                questionCard.classList.add('wrong-animation');
                setTimeout(() => {
                    questionCard.classList.remove('wrong-animation');
                }, 600);
            }
        },
        
        calculateSimilarity(str1, str2) {
            // Basit benzerlik algoritması
            const words1 = str1.split(' ').filter(w => w.length > 2);
            const words2 = str2.split(' ').filter(w => w.length > 2);
            
            let matchCount = 0;
            for (const word1 of words1) {
                for (const word2 of words2) {
                    if (word1.includes(word2) || word2.includes(word1)) {
                        matchCount++;
                        break;
                    }
                }
            }
            
            return matchCount / Math.max(words1.length, words2.length);
        },
        
        skipQuestion() {
            this.showFeedback('Soru atlandı!', 'wrong');
            setTimeout(() => {
                this.generateNewQuestion();
            }, 1000);
        },
        
        newGame() {
            this.score = 0;
            this.correctAnswers = 0;
            this.wrongAnswers = 0;
            this.totalQuestions = 0;
            this.usedQuestions = [];
            this.selectedChoice = -1;
            this.answerSubmitted = false;
            this.generateNewQuestion();
            this.showFeedback('Yeni oyun başladı! Bol şans! 🚌', 'correct');
        },
        
        showFeedback(message, type) {
            this.feedback = message;
            this.feedbackType = type;
        },
        
        clearFeedback() {
            this.feedback = '';
            this.feedbackType = '';
        },
        
        setupKeyboardShortcuts() {
            document.addEventListener('keydown', (event) => {
                // Input alanına yazarkendir, klavye kısayollarını devre dışı bırak
                if (event.target.tagName === 'INPUT') {
                    return;
                }
                
                switch(event.code) {
                    case 'Space':
                        event.preventDefault();
                        this.skipQuestion();
                        this.playSound('click');
                        break;
                    case 'Enter':
                        event.preventDefault();
                        if (this.gameMode !== 'multipleChoice') {
                            this.submitAnswer();
                        }
                        break;
                    case 'KeyN':
                        event.preventDefault();
                        this.newGame();
                        this.playSound('click');
                        break;
                    case 'Digit1':
                    case 'KeyA':
                        if (this.gameMode === 'multipleChoice' && !this.answerSubmitted) {
                            event.preventDefault();
                            this.selectChoice(0);
                        }
                        break;
                    case 'Digit2':
                    case 'KeyB':
                        if (this.gameMode === 'multipleChoice' && !this.answerSubmitted) {
                            event.preventDefault();
                            this.selectChoice(1);
                        }
                        break;
                    case 'Digit3':
                    case 'KeyC':
                        if (this.gameMode === 'multipleChoice' && !this.answerSubmitted) {
                            event.preventDefault();
                            this.selectChoice(2);
                        }
                        break;
                    case 'Digit4':
                    case 'KeyD':
                        if (this.gameMode === 'multipleChoice' && !this.answerSubmitted) {
                            event.preventDefault();
                            this.selectChoice(3);
                        }
                        break;
                }
            });
        }
    }
}).mount('#app'); 