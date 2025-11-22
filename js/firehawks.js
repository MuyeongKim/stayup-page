/**
 * Firehawks Page Specific JavaScript
 */

// Player Data
const playerData = {
    sjh: {
        name: '신준호',
        position: '멀티플레이어',
        image: '/images/pic-sjh.jpg',
        careerYears: '15년',
        droneYears: '8년',
        specialty: '재난현장 지휘, 드론 정찰',
        biography: `
            <p>전북소방본부에서 15년간 근무하며 다양한 재난 현장에서 활약한 베테랑 소방관입니다. 파이어호크스의 단장으로서 팀을 이끌고 있으며, 드론 축구를 통해 실무 능력을 향상시키는 데 앞장서고 있습니다.</p>
            <p>특히 산악 구조와 화재 진압 분야에서 뛰어난 전문성을 보여주고 있으며, 드론 기술을 활용한 재난 대응 시스템 구축에 핵심적인 역할을 하고 있습니다.</p>
        `,
        achievements: [
            '전북소방본부 우수 소방관 표창 (2023)',
            '드론 구조 작전 성공 사례 50건 달성',
            '파이어호크스 팀 창단 및 운영',
            '소방드론 운용 교육 프로그램 개발',
            '전국 드론축구 대회 참가 및 팀 지휘'
        ]
    },
    ydg: {
        name: '양대건',
        position: '멀티플레이어',
        image: '/images/pic-ydg.png',
        careerYears: '12년',
        droneYears: '6년',
        specialty: '화재 진압, 드론 조종',
        biography: `
            <p>화재 진압 전문가로 12년간 현장에서 활동하며 수많은 생명을 구한 소방관입니다. 정밀한 드론 조종 실력으로 파이어호크스의 핵심 플레이어 역할을 하고 있습니다.</p>
            <p>특히 고층 건물 화재와 산불 진압에서 뛰어난 능력을 발휘하며, 드론을 활용한 화재 현장 분석과 전략 수립에 탁월한 능력을 보여주고 있습니다.</p>
        `,
        achievements: [
            '고층 빌딩 화재 진압 공로상 수상',
            '드론을 활용한 산불 진압 작전 성공',
            '소방 드론 조종 자격증 1급 취득',
            '화재 예방 교육 프로그램 개발 참여',
            '드론축구 대회 우수선수 선정 (2024)'
        ]
    },
    kmy: {
        name: '김무영',
        position: '멀티플레이어',
        image: '/images/pic-kmy.jpg',
        careerYears: '10년',
        droneYears: '5년',
        specialty: '응급구조, 의료진 지원',
        biography: `
            <p>응급구조사 자격을 보유한 소방관으로, 생명이 위급한 상황에서 신속하고 정확한 판단력을 발휘합니다. 드론 축구에서도 이러한 순간적인 판단력이 팀에 큰 도움이 되고 있습니다.</p>
            <p>의료진과의 협력을 통한 구조 작업에 전문성을 갖추고 있으며, 드론을 활용한 응급환자 이송 지원 시스템 개발에도 참여하고 있습니다.</p>
        `,
        achievements: [
            '응급구조사 1급 자격 취득',
            '생명구조 유공 표창장 수상 (2022)',
            '드론 활용 응급환자 구조 성공 사례 30건',
            '응급의료 교육 강사 활동',
            '전국 드론축구 대회 기술상 수상'
        ]
    },
    bgh: {
        name: '방극환',
        position: '멀티플레이어',
        image: '/images/pic-bgh.jpg',
        careerYears: '13년',
        droneYears: '7년',
        specialty: '수상구조, 특수재난 대응',
        biography: `
            <p>수상구조 전문가로 강과 바다에서의 구조 작업을 담당하고 있습니다. 물과 관련된 재난 상황에서 드론을 활용한 구조 작업의 선구자 역할을 하고 있습니다.</p>
            <p>특수재난 상황에서의 드론 운용 경험이 풍부하여, 드론 축구에서도 예측 불가능한 상황에 대한 대응 능력이 뛰어나며, 이는 드론 축구의 복잡한 전술 상황에서도 빛을 발하고 있습니다.</p>
        `,
        achievements: [
            '수상구조 전문자격 취득',
            '특수재난 대응 우수 소방관 표창',
            '드론 수상구조 시스템 개발 참여',
            '수상안전 교육 프로그램 강사',
            '드론축구 대회 베스트 플레이어 선정'
        ]
    },
    kjh: {
        name: '김재현',
        position: '멀티플레이어',
        image: '/images/pic-kjh.jpg',
        careerYears: '9년',
        droneYears: '4년',
        specialty: '도시재난 대응, 교통사고 처리',
        biography: `
            <p>도시지역 재난 대응과 교통사고 처리를 전담하는 소방관입니다. 복잡한 도시 환경에서의 드론 운용 능력이 뛰어나며, 이는 드론 축구의 복잡한 전술 상황에서도 빛을 발하고 있습니다.</p>
            <p>신속한 현장 판단과 정확한 드론 조종으로 많은 시민들의 생명을 구했으며, 젊은 소방관들의 멘토 역할도 하고 있습니다.</p>
        `,
        achievements: [
            '도시재난 대응 우수활동 표창',
            '교통사고 현장 드론 활용 우수사례 선정',
            '소방 신규 교육 프로그램 개발',
            '드론 기술 혁신 아이디어 공모전 수상',
            '후배 소방관 멘토링 프로그램 운영'
        ]
    },
    hsp: {
        name: '하승표',
        position: '멀티플레이어',
        image: '/images/pic-hsp.webp',
        careerYears: '11년',
        droneYears: '6년',
        specialty: '산악구조, 자연재난 대응',
        biography: `
            <p>산악구조 전문가로 험난한 산악지형에서의 구조 작업을 담당하고 있습니다. 어려운 지형과 기상 조건에서도 안정적인 드론 운용 능력을 보여주며, 이는 드론 축구에서도 강인한 정신력으로 나타납니다.</p>
            <p>자연재난 대응 경험이 풍부하여 예측 불가능한 상황에서의 대처 능력이 뛰어나며, 팀의 든든한 버팀목 역할을 하고 있습니다.</p>
        `,
        achievements: [
            '산악구조 전문자격 취득',
            '자연재난 대응 공로상 수상',
            '극한 환경 드론 운용 매뉴얼 작성',
            '산악구조 교육 프로그램 강사',
            '드론축구 대회 최우수 팀플레이어 선정'
        ]
    },
    kmg: {
        name: '김민규',
        position: '멀티플레이어',
        image: '/images/pic-kmg.jpg',
        careerYears: '7년',
        droneYears: '3년',
        specialty: '기술지원, 장비관리',
        biography: `
            <p>소방장비와 드론 기술 관리를 담당하는 기술 전문가입니다. 최신 드론 기술과 소방 장비에 대한 깊은 이해를 바탕으로 팀의 기술적 지원을 담당하고 있습니다.</p>
            <p>파이어호크스의 막내이지만, 뛰어난 기술력과 빠른 학습능력으로 팀에 신선한 에너지를 불어넣고 있으며, 차세대 소방관의 모범 사례가 되고 있습니다.</p>
        `,
        achievements: [
            '드론 정비 전문자격 취득',
            '소방장비 기술혁신 아이디어 제안',
            '드론 기술 워크샵 강사 활동',
            '신입 소방관 기술교육 담당',
            '드론축구 대회 신인상 수상 (2024)'
        ]
    }
};

// Gallery Data
const galleryPhotos = [
    {
        src: '/images/2024namwon.jpg',
        alt: '남원시장배 전국드론축구대회',
        caption: '창단 후 첫 출전한 남원시장배 대회 현장'
    }
];

let currentPhotoIndex = 0;
let autoSlideInterval;

function updateGalleryPhoto(index) {
    const photo = galleryPhotos[index];
    const photoElement = document.getElementById('recordsPhoto');
    const captionElement = document.getElementById('photoCaption');
    const dots = document.querySelectorAll('.gallery-dot');
    const recordItems = document.querySelectorAll('.record-item');

    if (!photoElement || !captionElement) return;

    // Update active dot
    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === index);
    });

    // Update active record item
    recordItems.forEach((item, i) => {
        item.classList.toggle('active', i === index);
    });

    // Update photo and caption
    if (photo.src) {
        photoElement.innerHTML = `<img src="${photo.src}" alt="${photo.alt}" onerror="this.style.display='none'; this.parentElement.innerHTML='<div class=\'photo-placeholder\'><div><i class=\'fas fa-camera\' style=\'font-size: 3rem; margin-bottom: 15px; display: block;\'></i><h5>이미지 준비중</h5><p>${photo.alt}</p></div></div>'">`;
    } else {
        photoElement.innerHTML = `
            <div class="photo-placeholder">
                <div>
                    <i class="fas fa-camera" style="font-size: 3rem; margin-bottom: 15px; display: block;"></i>
                    <h5>대회 현장 사진</h5>
                    <p>${photo.alt}</p>
                </div>
            </div>
        `;
    }

    captionElement.textContent = photo.caption;
    currentPhotoIndex = index;
}

function startAutoSlide() {
    if (autoSlideInterval) clearInterval(autoSlideInterval);
    autoSlideInterval = setInterval(() => {
        const nextIndex = (currentPhotoIndex + 1) % galleryPhotos.length;
        updateGalleryPhoto(nextIndex);
    }, 6000);
}

function initializeGallery() {
    const dots = document.querySelectorAll('.gallery-dot');
    const recordItems = document.querySelectorAll('.record-item');

    if (dots.length === 0) return;

    // Dot navigation
    dots.forEach((dot, index) => {
        dot.addEventListener('click', () => {
            clearInterval(autoSlideInterval);
            updateGalleryPhoto(index);
            startAutoSlide();
        });
    });

    // Record item hover navigation
    recordItems.forEach((item, index) => {
        item.addEventListener('mouseenter', () => {
            clearInterval(autoSlideInterval);
            updateGalleryPhoto(index);
        });

        item.addEventListener('mouseleave', () => {
            startAutoSlide();
        });

        item.addEventListener('click', () => {
            clearInterval(autoSlideInterval);
            updateGalleryPhoto(index);
            startAutoSlide();
        });
    });

    // Initialize with first item active
    updateGalleryPhoto(0);
    startAutoSlide();
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

// Initialize Firehawks specific functions
document.addEventListener('DOMContentLoaded', () => {
    initializeGallery();

    // Start particle system
    if (document.getElementById('particles')) {
        setInterval(createParticle, 300);
    }
});
