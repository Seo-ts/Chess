# Chess

ai self tuning 기능 추가
ai 자가 대국 기능 추가
탐색 종료 시점에 checkt상태면 => depth +1 

//==============================================

**self tuning 하는 법**
튜닝 켜기
toggleSelfTuning(true)

튜닝 끄기
toggleSelfTuning(false)

**자가 대국 시작하는 법**
startSelfPlay(대국판수, 미들게임 뎁스, 엔드게임 뎁스, 시간텀(ms, 넉넉하게 추천))
게임 뎁스 => 짝수 추천(홀수로 튜닝하는 경우 값 뒤틀림)
ex)startSelfPlay(1,4,4,500) , 1판, 뎁스4, 시간텀 0.5s

**튜닝 결과 확인/리셋 법**
showCurrentWeights()
resetAITuning()

//================================================

**튜닝 원리**
Error = searchScore(Depth탐색 최고 점수)-staticScore(현재 보드 점수)

updateAmount = error * featureDirection * learningRate

error를 줄여나가는 방향으로 계속해서 updateAmount만큼 가중치들이 움직임(eval_weights에 있는 가중치들)

