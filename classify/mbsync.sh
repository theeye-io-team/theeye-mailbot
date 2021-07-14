export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/games
export HOME=/root/
export LANG=en_US.UTF-8  
export LANGUAGE=en_US:en  
export LC_ALL=en_US.UTF-8   

mailbot="${MAILBOT_WORKING_DIRECTORY}"
folder="HSBC"
folder_procesados="HSBC_Procesados"

# pull or push
actionParam="${MBSYNC_SYNC_ACTION}"

main () {
  
  [ ! -d "${mailbot}/${folder}" ] && mkdir -p "${mailbot}/${folder}"
  [ ! -d "${mailbot}/${folder_procesados}" ] && mkdir -p "${mailbot}/${folder_procesados}"
  
  tempPath="${mailbot}/procesa_${folder}_tmp"
  if [[ ! -d ${tempPath} ]]
  then 
	  mkdir ${tempPath}
  fi

  # CLEAN TMP
  rm "${tempPath}/*"

  #if [[ "${actionParam}" -eq "push" ]]
  #then
  #	echo "pushin messages"
	#	mbsync --push -D -V -c ${MBSYNC_CONFIG_FILE} gmail
  #else
  #	echo "pulling messages"
  #	mbsync --pull -D -V -c ${MBSYNC_CONFIG_FILE} gmail
  #fi
  
  mbsync -c  ${MBSYNC_CONFIG_FILE} gmail
  
#   for file in ${mailbot}/${folder}/new/* ${mailbot}/${folder}/cur/*
#   do
#   	[[ -e "$file" ]] || continue

#   	echo -e "\nProcessing mail file: ${file}"
#     cp "${file}" "${tempPath}/temporalMail"
    
#     mailFrom=$(grep ^From "$tempPath"/temporalMail | grep --only-matching -E "\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,6}\b" | uniq)
#     mailSubject=$(grep Subject "$tempPath"/temporalMail | tr -d '\n')
#     mailDate=$(date --date="$(grep Date "$tempPath"/temporalMail | head -n1 | sed 's/Date: //g')" "+%d%m%Y")
#     mailMessageID=$(grep -A 1 'Message-ID:' "$tempPath"/temporalMail | head -n2 | grep -oE '<.*>' | tr -d '<' | tr -d '>' | head -n1)
#     mailHash=$(echo "${mailMessageID}" | md5sum | awk '{print $1}')
    
#     echo "Info | From: ${mailFrom} Subject: ${mailSubject} Date: ${mailDate} Message-ID: ${mailMessageID} Hash: ${mailHash}"
#   done

# 	ls -l "${mailbot}"
}

main