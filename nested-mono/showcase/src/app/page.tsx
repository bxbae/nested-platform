"use client";

import { useState } from "react";
import { Heart, Home, Bell, MapPin } from "lucide-react";
import {
  Button, Input, Textarea, Label, Badge, Chip, Avatar, Skeleton, Spinner,
  Divider, IconButton, Rating, Switch, Tooltip, TooltipProvider,
  SearchBar, PriceTag, FilterChip, MessageBubble,
  Tabs, TabsList, TabsTrigger, TabsContent,
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
  Dropdown, DropdownTrigger, DropdownContent, DropdownItem,
  Breadcrumb, Pagination, StatCard, EmptyState,
} from "@nested/ui";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-sm font-mono uppercase tracking-widest text-secondary">{title}</h2>
      <div className="flex flex-wrap items-center gap-4">{children}</div>
    </section>
  );
}

export default function Showcase() {
  const [rating, setRating] = useState(4);
  const [on, setOn] = useState(true);
  const [chip, setChip] = useState("share");
  const [page, setPage] = useState(2);

  return (
    <TooltipProvider>
      <main className="mx-auto max-w-4xl space-y-12 px-8 py-16">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">@nested/ui</h1>
          <p className="text-muted-foreground">Atoms + molecules · shadcn 기반 · 코럴/틸 토큰</p>
        </header>

        <Section title="Button">
          <Button>기본</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="destructive">삭제</Button>
          <Button loading>처리 중</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
        </Section>

        <Section title="Input / Label / Textarea">
          <div className="w-64 space-y-1.5">
            <Label htmlFor="e" required>이메일</Label>
            <Input id="e" placeholder="you@nested.kr" />
          </div>
          <div className="w-64 space-y-1.5">
            <Label htmlFor="p">비밀번호</Label>
            <Input id="p" type="password" invalid placeholder="오류 상태" />
          </div>
          <Textarea className="w-72" placeholder="자기소개를 적어주세요" />
        </Section>

        <Section title="Badge / Chip / FilterChip">
          <Badge>중립</Badge>
          <Badge variant="primary">코럴</Badge>
          <Badge variant="secondary">틸</Badge>
          <Badge variant="success">확정</Badge>
          <Badge variant="warning">대기</Badge>
          <Badge variant="destructive">취소</Badge>
          <Chip active={chip === "one"} onClick={() => setChip("one")}>원룸</Chip>
          <Chip active={chip === "share"} onClick={() => setChip("share")}>쉐어룸</Chip>
          <FilterChip label="반려동물 가능" onRemove={() => {}} />
        </Section>

        <Section title="Avatar / Rating / Switch / Spinner / Divider">
          <Avatar name="김병환" verified />
          <Avatar size="lg" name="Mina" />
          <Rating value={rating} count={132} onChange={setRating} />
          <Switch checked={on} onCheckedChange={setOn} aria-label="알림" />
          <Spinner />
          <Divider orientation="vertical" className="h-8" />
          <Tooltip content="찜하기">
            <IconButton label="찜하기"><Heart className="h-5 w-5" /></IconButton>
          </Tooltip>
        </Section>

        <Section title="Skeleton">
          <div className="w-64 space-y-3 rounded-lg border border-border p-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </Section>

        <Section title="SearchBar / PriceTag">
          <SearchBar className="w-80" placeholder="지역, 숙소명으로 검색" />
          <PriceTag amount={780000} size="lg" />
        </Section>

        <Section title="MessageBubble">
          <div className="w-full max-w-md space-y-3 rounded-lg border border-border p-4">
            <MessageBubble author={{ name: "호스트" }} body="안녕하세요! 입주 문의 주셔서 감사합니다." timestamp="오후 2:10" />
            <MessageBubble mine read body="네, 다음 주 금요일에 방문 가능할까요?" timestamp="오후 2:12" />
            <MessageBubble mine body="사진도 몇 장 보내주시면 좋겠어요." timestamp="오후 2:12" />
          </div>
        </Section>

        <Section title="Tabs">
          <Tabs defaultValue="a" className="w-full">
            <TabsList>
              <TabsTrigger value="a">방 소개</TabsTrigger>
              <TabsTrigger value="b">시설</TabsTrigger>
              <TabsTrigger value="c">리뷰</TabsTrigger>
            </TabsList>
            <TabsContent value="a" className="pt-4 text-sm text-muted-foreground">방 소개 콘텐츠</TabsContent>
            <TabsContent value="b" className="pt-4 text-sm text-muted-foreground">시설 콘텐츠</TabsContent>
            <TabsContent value="c" className="pt-4 text-sm text-muted-foreground">리뷰 콘텐츠</TabsContent>
          </Tabs>
        </Section>

        <Section title="Accordion">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="1">
              <AccordionTrigger>어떤 편의시설이 있나요?</AccordionTrigger>
              <AccordionContent>공용 주방, 세탁실, 옥상, 코워킹룸을 제공합니다.</AccordionContent>
            </AccordionItem>
            <AccordionItem value="2">
              <AccordionTrigger>최소 계약 기간은?</AccordionTrigger>
              <AccordionContent>3개월부터 가능하며 월 단위로 연장됩니다.</AccordionContent>
            </AccordionItem>
          </Accordion>
        </Section>

        <Section title="Dropdown">
          <Dropdown>
            <DropdownTrigger asChild><Button variant="outline">메뉴 열기</Button></DropdownTrigger>
            <DropdownContent>
              <DropdownItem><Home className="h-4 w-4" /> 내 숙소</DropdownItem>
              <DropdownItem><Bell className="h-4 w-4" /> 알림</DropdownItem>
              <DropdownItem><MapPin className="h-4 w-4" /> 예약 내역</DropdownItem>
            </DropdownContent>
          </Dropdown>
        </Section>

        <Section title="Breadcrumb / Pagination / StatCard">
          <Breadcrumb items={[{ label: "홈", href: "/" }, { label: "검색", href: "/search" }, { label: "성수 룸" }]} />
          <Pagination page={page} pageCount={8} onPageChange={setPage} />
        </Section>
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="이번 달 매출" value="₩12,400,000" delta={{ value: "8.2%", positive: true }} />
          <StatCard label="예약 건수" value="34" delta={{ value: "3.1%", positive: false }} />
          <StatCard label="입주율" value="86%" />
        </div>

        <Section title="EmptyState">
          <EmptyState
            icon={<Home className="h-8 w-8" />}
            title="아직 예약이 없어요"
            description="마음에 드는 숙소를 찾아 첫 예약을 시작해보세요."
            action={<Button>숙소 둘러보기</Button>}
          />
        </Section>
      </main>
    </TooltipProvider>
  );
}
