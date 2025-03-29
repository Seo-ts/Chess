# Chess
즐기는 법
1. console창을 킨다.
2. 나의 턴을 확인한다.
3. 체스를 둔다.
4. 난이도 조절 ==> 코드 후반부의 const score = alphaBeta(newBoard, 2, -Infinity, Infinity, false); 를 찾아 숫자를 2(=depth 값)에서 2 이상의 수로 바꾸면 됨. 너무 많이 올리면 컴터가 힘들어하니 사정에 맞게 올리도록한다.(6이상은 힘들것같음)

오류 사항 
1. ai는 흑만 둘 수 있음
2. 흑이 먼저두는 이상한 이세계 체스룰(변경시급)
