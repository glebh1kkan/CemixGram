#!/bin/bash
# Resume giftfetch until clean exit, accumulating allow-missing-thumb entries.
export SESSION=/root/CemixGram/.session/coach.session
cd /root/CemixGram || exit 1
ALLOW="5251512570732381560:photo:m"
LASTSTUCK=""
STREAK=0
for i in $(seq 1 40); do
  ./bin/fetchers/giftfetch -workers 1 -allow-missing-thumb "$ALLOW" \
    -out /root/CemixGram/seed-src/official-gifts > /root/CemixGram/logs/gf-pass.log 2>&1
  EC=$?
  TAIL=$(tail -2 /root/CemixGram/logs/gf-pass.log)
  echo "PASS $i exit=$EC :: $TAIL"
  if [ $EC -eq 0 ]; then echo "CLEAN_DONE"; break; fi
  STUCK=$(grep -o 'download document [0-9]* [a-z]* thumb "[a-z]*"' /root/CemixGram/logs/gf-pass.log | tail -1)
  if [ -z "$STUCK" ]; then
    STUCK=$(grep -o 'download document [0-9]*' /root/CemixGram/logs/gf-pass.log | tail -1)
  fi
  if [ -n "$STUCK" ]; then
    if [ "$STUCK" = "$LASTSTUCK" ]; then
      STREAK=$((STREAK + 1))
    else
      LASTSTUCK="$STUCK"
      STREAK=0
    fi
    if echo "$STUCK" | grep -q thumb; then
      ID=$(echo "$STUCK" | awk '{print $3}')
      KIND=$(echo "$STUCK" | awk '{print $4}')
      TYPE=$(echo "$STUCK" | sed 's/.*thumb "//;s/"//')
      ENTRY="$ID:$KIND:$TYPE"
      case "$ALLOW" in
        *"$ENTRY"*) ;;
        *) ALLOW="$ALLOW,$ENTRY"; echo "added to allow-list: $ENTRY" ;;
      esac
    fi
    WAIT=$((90 * (STREAK + 1)))
    if [ $WAIT -gt 1800 ]; then WAIT=1800; fi
    echo "same stuck=$STUCK streak=$STREAK waiting ${WAIT}s"
    sleep $WAIT
  else
    STREAK=0
    echo "no stuck doc, waiting 90s"
    sleep 90
  fi
done
find /root/CemixGram/seed-src/official-gifts -type f | wc -l
du -sh /root/CemixGram/seed-src/official-gifts
