/**
 * Stayup Page Specific JavaScript
 */

// Team Member Data
const memberData = {
    sjh: {
        name: '신준호',
        position: '회장',
        team: 'Stay-Up',
        image: '../images/pic-sjh.jpg',
        department: '남원소방서 인월119안전센터',
        certification: '지도조종자',
        activities: '전북소방드론팀(Stay-Up) 창설 및 운영'
    },
    kmy: {
        name: '김무영',
        position: '부회장',
        team: 'Stay-Up',
        image: '../images/pic-kmy.jpg',
        department: '완주소방서 119구조대',
        certification: '지도조종자',
        activities: '전북소방드론팀(Stay-Up) / 드론축구팀(FireHawks)'
    },
    jys: {
        name: '조용석',
        position: '대원',
        team: 'Stay-Up',
        image: '../images/pic-jys.png',
        department: '119특수대응단',
        certification: '드론조종자',
        activities: '재난현장 드론 운용 및 구조활동 지원'
    },
    ydg: {
        name: '양대건',
        position: '대원',
        team: 'Stay-Up',
        image: '../images/pic-ydg.png',
        department: '장수소방서',
        certification: '드론조종자',
        activities: '재난현장 드론 운용'
    },
    kjh: {
        name: '김재현',
        position: '대원',
        team: 'Stay-Up',
        image: '../images/pic-kjh.jpg',
        department: '119특수대응단',
        certification: '드론조종자',
        activities: '재난현장 드론 운용 및 구조활동 지원'
    },
    bgh: {
        name: '방극환',
        position: '대원',
        team: 'Stay-Up',
        image: '../images/pic-bgh.jpg',
        department: '군산소방서',
        certification: '드론조종자',
        activities: '재난현장 드론 운용'
    },
    ldy: {
        name: '이동윤',
        position: '대원',
        team: 'Stay-Up',
        image: '../images/pic-ldy.png',
        department: '익산소방서',
        certification: '드론조종자',
        activities: '재난현장 드론 운용'
    },
    hsp: {
        name: '하승표',
        position: '대원',
        team: 'Stay-Up',
        image: '../images/pic-hsp.webp',
        department: '무주소방서',
        certification: '드론조종자',
        activities: '재난현장 드론 운용'
    },
    kmg: {
        name: '김민규',
        position: '대원',
        team: 'Stay-Up',
        image: '../images/pic-kmg.jpg',
        department: '완산소방서',
        certification: '드론조종자',
        activities: '재난현장 드론 운용'
    },
    kgw: {
        name: '강계원',
        position: '대원',
        team: 'Stay-Up',
        image: '../images/pic-kgw.png',
        department: '남원소방서',
        certification: '드론조종자',
        activities: '재난현장 드론 운용'
    },
    gyj: {
        name: '공영진',
        position: '대원',
        team: 'Stay-Up',
        image: '../images/pic-gyj.png',
        department: '남원소방서',
        certification: '드론조종자',
        activities: '재난현장 드론 운용'
    },
    kgs: {
        name: '김광수',
        position: '대원',
        team: 'Stay-Up',
        image: '../images/pic-kgs.png',
        department: '119특수대응단',
        certification: '드론조종자',
        activities: '재난현장 드론 운용 및 구조활동 지원'
    },
    kih: {
        name: '김익헌',
        position: '대원',
        team: 'Stay-Up',
        image: '../images/pic-kih.png',
        department: '군산소방서',
        certification: '드론조종자',
        activities: '재난현장 드론 운용'
    },
    kch: {
        name: '김찬희',
        position: '대원',
        team: 'Stay-Up',
        image: '../images/pic-kch.png',
        department: '완주소방서',
        certification: '드론조종자',
        activities: '재난현장 드론 운용'
    },
    pyh: {
        name: '박요한',
        position: '대원',
        team: 'Stay-Up',
        image: '../images/pic-pyh.png',
        department: '임실소방서',
        certification: '드론조종자',
        activities: '재난현장 드론 운용'
    },
    pch: {
        name: '박치훈',
        position: '대원',
        team: 'Stay-Up',
        image: '../images/pic-pch.png',
        department: '김제소방서',
        certification: '드론조종자',
        activities: '재난현장 드론 운용'
    },
    bsh: {
        name: '방성호',
        position: '대원',
        team: 'Stay-Up',
        image: '../images/pic-bsh.png',
        department: '119특수대응단',
        certification: '드론조종자',
        activities: '재난현장 드론 운용 및 구조활동 지원'
    },
    bjm: {
        name: '방정민',
        position: '대원',
        team: 'Stay-Up',
        image: '../images/pic-bjm.png',
        department: '남원소방서',
        certification: '드론조종자',
        activities: '재난현장 드론 운용'
    },
    ssg: {
        name: '소순기',
        position: '대원',
        team: 'Stay-Up',
        image: '../images/pic-ssg.png',
        department: '김제소방서',
        certification: '드론조종자',
        activities: '재난현장 드론 운용'
    },
    ssy: {
        name: '송수용',
        position: '대원',
        team: 'Stay-Up',
        image: '../images/pic-ssy.png',
        department: '119특수대응단',
        certification: '드론조종자',
        activities: '재난현장 드론 운용 및 구조활동 지원'
    },
    scs: {
        name: '신창수',
        position: '대원',
        team: 'Stay-Up',
        image: '../images/pic-scs.png',
        department: '남원소방서',
        certification: '드론조종자',
        activities: '재난현장 드론 운용'
    },
    yps: {
        name: '유평수',
        position: '대원',
        team: 'Stay-Up',
        image: '../images/pic-yps.png',
        department: '덕진소방서',
        certification: '드론조종자',
        activities: '재난현장 드론 운용'
    },
    yjs: {
        name: '윤지성',
        position: '대원',
        team: 'Stay-Up',
        image: '../images/pic-yjs.png',
        department: '119특수대응단',
        certification: '드론조종자',
        activities: '재난현장 드론 운용 및 구조활동 지원'
    },
    lyc: {
        name: '이용철',
        position: '대원',
        team: 'Stay-Up',
        image: '../images/pic-lyc.png',
        department: '완산소방서',
        certification: '드론조종자',
        activities: '재난현장 드론 운용'
    },
    ciy: {
        name: '최인율',
        position: '대원',
        team: 'Stay-Up',
        image: '../images/pic-ciy.png',
        department: '남원소방서',
        certification: '드론조종자',
        activities: '재난현장 드론 운용'
    },
    cjh: {
        name: '최재호',
        position: '대원',
        team: 'Stay-Up',
        image: '../images/pic-cjh.png',
        department: '완산소방서',
        certification: '드론조종자',
        activities: '재난현장 드론 운용'
    }
};

// Member Modal Functions
function openMemberModal(memberId) {
    const member = memberData[memberId];
    const modalImage = document.getElementById('modalMemberImage');

    if (!member) {
        // 데이터가 없는 경우 기본 정보 표시
        document.getElementById('modalMemberName').textContent = '준비 중';
        document.getElementById('modalMemberPosition').textContent = '';
        document.getElementById('modalMemberTeam').textContent = 'Stay-Up';
        modalImage.src = '';
        modalImage.style.display = 'none';
        document.getElementById('modalDepartment').textContent = '전북소방본부';
        document.getElementById('modalCertification').textContent = '드론조종자';
        document.getElementById('modalActivities').textContent = '세부 정보 준비 중입니다.';
    } else {
        document.getElementById('modalMemberName').textContent = member.name;
        document.getElementById('modalMemberPosition').textContent = member.position;
        document.getElementById('modalMemberTeam').textContent = member.team;

        // 이미지 설정 및 표시
        modalImage.style.display = 'block';
        modalImage.src = member.image;
        modalImage.onerror = function () {
            this.style.display = 'none';
        };

        document.getElementById('modalDepartment').textContent = member.department;
        document.getElementById('modalCertification').textContent = member.certification;
        document.getElementById('modalActivities').textContent = member.activities;
    }

    const modal = document.getElementById('memberModal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeMemberModal() {
    const modal = document.getElementById('memberModal');
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
}

// Hero Slideshow
function initSlideshow() {
    const slides = document.querySelectorAll('.hero-slide');
    const dots = document.querySelectorAll('.slide-dot');

    if (slides.length === 0) return;

    let currentSlide = 0;
    const slideInterval = 5000;
    let slideTimer;

    function showSlide(index) {
        if (index >= slides.length) currentSlide = 0;
        else if (index < 0) currentSlide = slides.length - 1;
        else currentSlide = index;

        slides.forEach(slide => slide.classList.remove('active'));
        dots.forEach(dot => dot.classList.remove('active'));

        slides[currentSlide].classList.add('active');
        dots[currentSlide].classList.add('active');
    }

    function nextSlide() {
        showSlide(currentSlide + 1);
    }

    // Auto slide
    slideTimer = setInterval(nextSlide, slideInterval);

    // Dot controls
    dots.forEach(dot => {
        dot.addEventListener('click', () => {
            const slideIndex = parseInt(dot.getAttribute('data-slide'));
            showSlide(slideIndex);
            clearInterval(slideTimer);
            slideTimer = setInterval(nextSlide, slideInterval);
        });
    });
}

// Particle System
function createParticle() {
    const particlesContainer = document.getElementById('particles');
    if (!particlesContainer) return;

    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.animationDuration = (Math.random() * 3 + 5) + 's';
    particle.style.animationDelay = Math.random() * 2 + 's';

    particlesContainer.appendChild(particle);

    setTimeout(() => {
        particle.remove();
    }, 8000);
}

// Initialize Stayup specific functions
document.addEventListener('DOMContentLoaded', () => {
    initSlideshow();

    // Start particle system
    if (document.getElementById('particles')) {
        setInterval(createParticle, 300);
    }
});
